import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { logger } from '../../utils/logger.js';
import { escapeLike } from '../../utils/sql.js';
import type {
  AuditActor,
  AuditGroup,
  AuditListResult,
  AuditLogDto,
  AuditLogRow,
  AuditRecordInput,
  ListAuditQuery,
} from './audit.types.js';

const GROUP_PREFIX: Record<AuditGroup, string> = {
  resources: 'resource.',
  categories: 'category.',
  users: 'user.',
  access: 'access.',
  import: 'import.',
  support: 'support.',
  auth: 'auth.',
};

/** Период в часах: подставляется в `INTERVAL n HOUR`. */
const PERIOD_HOURS: Record<Exclude<ListAuditQuery['period'], 'all'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

function parseDetails(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toDto(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    created_at: toIso(row.created_at),
    user_id: row.user_id,
    user_login: row.user_login,
    user_avatar_url: row.user_avatar_url || null,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_label: row.entity_label,
    details: parseDetails(row.details),
    ip: row.ip,
    user_agent: row.user_agent,
  };
}

function truncate(value: string | null | undefined, length: number): string | null {
  if (!value) return null;
  return value.slice(0, length);
}

/**
 * Записывает действие в журнал. Ошибка логирования не должна ломать
 * основной запрос — поэтому она только пишется в консоль сервера.
 */
export async function recordAudit(req: Request, input: AuditRecordInput): Promise<void> {
  try {
    const db = await getDb();

    await db.query(
      `INSERT INTO audit_log
         (id, user_id, user_login, action, entity_type, entity_id, entity_label, details, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.actor.id,
        truncate(input.actor.login, 32) ?? 'unknown',
        input.action,
        truncate(input.entityType, 24),
        truncate(input.entityId, 200),
        truncate(input.entityLabel, 200),
        input.details ? JSON.stringify(input.details) : null,
        truncate(req.ip, 64),
        truncate(req.get('user-agent'), 255),
      ],
    );
  } catch (error) {
    logger.error(`Не удалось записать действие «${input.action}» в журнал:`, error);
  }
}

/** Удобная обёртка для действий авторизованного администратора. */
export async function logAction(
  req: Request,
  input: Omit<AuditRecordInput, 'actor'> & { actor?: AuditActor },
): Promise<void> {
  const actor: AuditActor | null =
    input.actor ?? (req.auth ? { id: req.auth.sub, login: req.auth.login } : null);

  if (!actor) return;

  await recordAudit(req, { ...input, actor });
}

export async function listAudit(query: ListAuditQuery): Promise<AuditListResult> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.group) {
    params.push(`${GROUP_PREFIX[query.group]}%`);
    conditions.push('action LIKE ?');
  }

  if (query.period !== 'all') {
    conditions.push(`created_at >= CURRENT_TIMESTAMP(3) - INTERVAL ${PERIOD_HOURS[query.period]} HOUR`);
  }

  if (query.user_id) {
    params.push(query.user_id);
    conditions.push('user_id = ?');
  }

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    params.push(pattern, pattern);
    conditions.push(
      "(entity_label LIKE ? ESCAPE '!' OR user_login LIKE ? ESCAPE '!')",
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(query.limit, query.offset);

  const result = await db.query<AuditLogRow>(
    `SELECT id,
            created_at,
            user_id,
            user_login,
            action,
            entity_type,
            entity_id,
            entity_label,
            details,
            ip,
            user_agent,
            (SELECT u.avatar_url FROM admin_users AS u WHERE u.id = audit_log.user_id) AS user_avatar_url,
            COUNT(*) OVER() AS total_count
       FROM audit_log
       ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    params,
  );

  return {
    data: result.rows.map(toDto),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}
