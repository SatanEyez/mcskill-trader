import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import { PRESENCE_WINDOW_MINUTES } from '../presence/presence.service.js';
import { normalizePermissions } from '../rbac/permissions.js';
import type {
  AdminRole,
  AdminUserBaseRow,
  AdminUserDto,
  AdminUserRow,
  ListUsersQuery,
  SessionUser,
  StaffSummary,
  UserCounts,
} from './user.types.js';

type UserRowWithRelations = AdminUserBaseRow & {
  reviewed_by_login: string | null;
  role_code: string | null;
  role_name: string | null;
  role_permissions: unknown;
  role_access_level: number | string | null;
  prefix_name: string | null;
  prefix_color: string | null;
  prefix_is_shiny: boolean | number | null;
  is_online: boolean | number;
};

const USER_SELECT = `
  SELECT u.id,
         u.login,
         u.role,
         u.status,
         u.role_id,
         u.prefix_id,
         u.is_system,
         u.discord,
         u.avatar_url,
         u.created_at,
         u.updated_at,
         u.reviewed_at,
         u.reviewed_by,
         u.last_login_at,
         u.last_seen_at,
         u.online_seconds,
         u.session_started_at,
         (u.last_seen_at IS NOT NULL
          AND u.last_seen_at >= CURRENT_TIMESTAMP(3)
                               - INTERVAL ${PRESENCE_WINDOW_MINUTES} MINUTE) AS is_online,
         -- Снимок логина ревьюера важнее JOIN: он переживает удаление администратора.
         COALESCE(u.reviewed_by_login, reviewer.login) AS reviewed_by_login,
         r.code AS role_code,
         r.name AS role_name,
         r.permissions AS role_permissions,
         r.access_level AS role_access_level,
         p.name AS prefix_name,
         p.color AS prefix_color,
         p.is_shiny AS prefix_is_shiny
    FROM admin_users AS u
    LEFT JOIN admin_users AS reviewer ON reviewer.id = u.reviewed_by
    LEFT JOIN admin_roles AS r ON r.id = u.role_id
    LEFT JOIN admin_prefixes AS p ON p.id = u.prefix_id
`;

function toDto(row: UserRowWithRelations): AdminUserDto {
  return {
    id: row.id,
    login: row.login,
    role: row.role,
    status: row.status,
    role_id: row.role_id,
    role_code: row.role_code,
    role_name: row.role_name,
    access_level: Number(row.role_access_level ?? 0),
    permissions: normalizePermissions(row.role_permissions),
    prefix:
      row.prefix_id && row.prefix_name && row.prefix_color
        ? {
            id: row.prefix_id,
            name: row.prefix_name,
            color: row.prefix_color,
            is_shiny: Boolean(row.prefix_is_shiny),
          }
        : null,
    is_system: Boolean(row.is_system),
    discord: row.discord,
    avatar_url: row.avatar_url || null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    reviewed_at: row.reviewed_at ? toIso(row.reviewed_at) : null,
    reviewed_by: row.reviewed_by,
    reviewed_by_login: row.reviewed_by_login ?? null,
    role_assigned_by_login: null,
    role_assigned_at: null,
    prefix_assigned_by_login: null,
    prefix_assigned_at: null,
    last_login_at: row.last_login_at ? toIso(row.last_login_at) : null,
    last_seen_at: row.last_seen_at ? toIso(row.last_seen_at) : null,
    online_seconds: Number(row.online_seconds ?? 0),
    session_started_at: row.session_started_at ? toIso(row.session_started_at) : null,
    is_online: Boolean(row.is_online),
  };
}

export async function findSessionUser(id: string): Promise<SessionUser | null> {
  const db = await getDb();
  const result = await db.query<SessionUser>(
    `SELECT u.id,
            u.login,
            u.role,
            u.status,
            u.password_hash,
            u.is_system,
            u.prefix_id,
            r.code AS role_code,
            r.name AS role_name,
            r.permissions,
            p.name AS prefix_name,
            p.color AS prefix_color,
            p.is_shiny AS prefix_is_shiny
       FROM admin_users AS u
       LEFT JOIN admin_roles AS r ON r.id = u.role_id
       LEFT JOIN admin_prefixes AS p ON p.id = u.prefix_id
      WHERE u.id = ?`,
    [id],
  );

  const row = result.rows[0];

  return row ? { ...row, is_system: Boolean(row.is_system) } : null;
}

export async function findAuthUserByLogin(login: string): Promise<AdminUserRow | null> {
  const db = await getDb();
  const result = await db.query<AdminUserRow>('SELECT * FROM admin_users WHERE login = ?', [login]);
  const row = result.rows[0];

  return row ? { ...row, is_system: Boolean(row.is_system) } : null;
}

export async function findAuthUserById(id: string): Promise<AdminUserRow | null> {
  const db = await getDb();
  const result = await db.query<AdminUserRow>('SELECT * FROM admin_users WHERE id = ?', [id]);
  const row = result.rows[0];

  return row ? { ...row, is_system: Boolean(row.is_system) } : null;
}

export async function getUserById(id: string): Promise<AdminUserDto> {
  const db = await getDb();
  const result = await db.query<UserRowWithRelations>(`${USER_SELECT} WHERE u.id = ?`, [id]);
  const row = result.rows[0];

  if (!row) {
    throw new HttpError(404, 'Администратор не найден');
  }

  return { ...toDto(row), ...(await findAssignments(id)) };
}

interface AssignmentRow {
  action: string;
  user_login: string;
  created_at: Date | string;
  details: unknown;
}

function readDetails(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Пара «было → стало» из details журнала. */
function readPair(value: unknown): { from: unknown; to: unknown } | null {
  if (!value || typeof value !== 'object') return null;

  const pair = value as { from?: unknown; to?: unknown };

  return 'from' in pair || 'to' in pair
    ? { from: pair.from ?? null, to: pair.to ?? null }
    : null;
}

/**
 * Кто и когда последним выдал роль и префикс. Отдельных колонок нет —
 * берём из журнала действий (`user.role_change` / `access.user_update`).
 */
async function findAssignments(id: string): Promise<{
  role_assigned_by_login: string | null;
  role_assigned_at: string | null;
  prefix_assigned_by_login: string | null;
  prefix_assigned_at: string | null;
}> {
  const db = await getDb();
  const result = await db.query<AssignmentRow>(
    `SELECT action, user_login, created_at, details
       FROM audit_log
      WHERE entity_type = 'user'
        AND entity_id = ?
        AND action IN ('user.role_change', 'access.user_update')
      ORDER BY created_at DESC
      LIMIT 50`,
    [id],
  );

  let role: { by: string; at: string } | null = null;
  let prefix: { by: string; at: string } | null = null;

  for (const row of result.rows) {
    const details = readDetails(row.details);
    const at = toIso(row.created_at);

    if (!role) {
      const pair =
        row.action === 'user.role_change' ? readPair(details) : readPair(details?.role);

      if (pair && pair.from !== pair.to) role = { by: row.user_login, at };
    }

    if (!prefix) {
      const pair = readPair(details?.prefix);

      if (pair && pair.from !== pair.to) prefix = { by: row.user_login, at };
    }

    if (role && prefix) break;
  }

  return {
    role_assigned_by_login: role?.by ?? null,
    role_assigned_at: role?.at ?? null,
    prefix_assigned_by_login: prefix?.by ?? null,
    prefix_assigned_at: prefix?.at ?? null,
  };
}

export interface ListUsersResult {
  data: AdminUserDto[];
  meta: UserCounts;
}

export async function listUsers(query: ListUsersQuery): Promise<ListUsersResult> {
  const db = await getDb();
  const params: unknown[] = [];
  const conditions: string[] = ['u.is_system = FALSE'];

  if (query.status) {
    params.push(query.status);
    conditions.push('u.status = ?');
  }

  const rows = await db.query<UserRowWithRelations>(
    `${USER_SELECT}
     WHERE ${conditions.join(' AND ')}
     ORDER BY CASE u.status
                WHEN 'pending' THEN 0
                WHEN 'approved' THEN 1
                ELSE 2
              END,
              u.created_at DESC`,
    params,
  );

  const counts = await db.query<UserCounts>(
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected
       FROM admin_users
      WHERE is_system = FALSE`,
  );

  const row = counts.rows[0];

  return {
    data: rows.rows.map(toDto),
    meta: {
      total: Number(row?.total ?? 0),
      pending: Number(row?.pending ?? 0),
      approved: Number(row?.approved ?? 0),
      rejected: Number(row?.rejected ?? 0),
    },
  };
}

export interface ListStaffResult {
  data: AdminUserDto[];
  meta: StaffSummary;
}

/**
 * Полный список администрации: все, у кого есть доступ в панель, с ролью,
 * правами и статистикой присутствия. Онлайн — сверху.
 */
export async function listStaff(): Promise<ListStaffResult> {
  const db = await getDb();
  const rows = await db.query<UserRowWithRelations>(
    `${USER_SELECT}
      WHERE u.is_system = FALSE
        AND u.status = 'approved'
      ORDER BY is_online DESC,
               CASE WHEN r.code = 'owner' THEN 0 ELSE 1 END,
               u.login ASC`,
  );

  const data = rows.rows.map(toDto);

  return {
    data,
    meta: {
      total: data.length,
      online: data.filter((user) => user.is_online).length,
      total_online_seconds: data.reduce((sum, user) => sum + user.online_seconds, 0),
    },
  };
}

/** Создаёт заявку на доступ: аккаунт сразу есть, но вход заблокирован до одобрения. */
export async function createPendingUser(login: string, passwordHash: string): Promise<AdminUserDto> {
  const db = await getDb();

  const duplicate = await db.query<{ id: string }>('SELECT id FROM admin_users WHERE login = ?', [
    login,
  ]);

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Такой логин уже занят');
  }

  // Новичок всегда начинает стажёром; администратора выдаёт владелец вручную.
  const role = await db.query<{ id: string }>(
    `SELECT id FROM admin_roles
      WHERE code IN ('chat_stajer', 'administrator')
      ORDER BY FIELD(code, 'chat_stajer', 'administrator')
      LIMIT 1`,
  );

  const id = randomUUID();
  await db.query(
    `INSERT INTO admin_users (id, login, password_hash, role, status, role_id)
     VALUES (?, ?, ?, 'admin', 'pending', ?)`,
    [id, login, passwordHash, role.rows[0]?.id ?? null],
  );

  return getUserById(id);
}

export async function touchLastLogin(id: string): Promise<void> {
  const db = await getDb();
  // Вход начинает новую сессию; время с прошлой отметки докидываем только
  // если админ был в панели меньше окна присутствия назад.
  await db.query(
    `UPDATE admin_users
        SET online_seconds = online_seconds + CASE
              WHEN last_seen_at IS NOT NULL
               AND last_seen_at >= CURRENT_TIMESTAMP(3) - INTERVAL ${PRESENCE_WINDOW_MINUTES} MINUTE
                THEN GREATEST(0, TIMESTAMPDIFF(SECOND, last_seen_at, CURRENT_TIMESTAMP(3)))
              ELSE 0
            END,
            last_login_at = CURRENT_TIMESTAMP(3),
            last_seen_at = CURRENT_TIMESTAMP(3),
            session_started_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [id],
  );
}

/**
 * Отметка присутствия. Пишем не чаще раза в минуту на администратора:
 * иначе каждый запрос к API превращался бы в UPDATE.
 * Заодно копим время в сети: каждый апдейт добавляет секунды, прошедшие
 * с прошлой отметки. Если пауза больше окна присутствия — начинаем новую сессию.
 */
export async function touchPresence(id: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE admin_users
        SET online_seconds = online_seconds + CASE
              WHEN last_seen_at IS NOT NULL
               AND last_seen_at >= CURRENT_TIMESTAMP(3) - INTERVAL ${PRESENCE_WINDOW_MINUTES} MINUTE
                THEN GREATEST(0, TIMESTAMPDIFF(SECOND, last_seen_at, CURRENT_TIMESTAMP(3)))
              ELSE 0
            END,
            session_started_at = CASE
              WHEN last_seen_at IS NULL
                OR last_seen_at < CURRENT_TIMESTAMP(3) - INTERVAL ${PRESENCE_WINDOW_MINUTES} MINUTE
                THEN CURRENT_TIMESTAMP(3)
              ELSE session_started_at
            END,
            last_seen_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
        AND (last_seen_at IS NULL
             OR last_seen_at < CURRENT_TIMESTAMP(3) - INTERVAL 60 SECOND)`,
    [id],
  );
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE admin_users
        SET password_hash = ?,
            password_changed_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [passwordHash, id],
  );
}

/** Ссылка на аватар (`/uploads/<uuid>.png`) или пустая строка, если его нет. */
export async function setUserAvatar(id: string, avatarUrl: string): Promise<AdminUserDto> {
  const db = await getDb();
  await db.query(
    `UPDATE admin_users
        SET avatar_url = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [avatarUrl, id],
  );

  return getUserById(id);
}

export async function approveUser(id: string, actor: AuthPayload): Promise<AdminUserDto> {
  const target = await getUserById(id);

  if (target.is_system) {
    throw new HttpError(400, 'Системный аккаунт нельзя одобрять вручную');
  }

  const db = await getDb();

  const internRole = await db.query<{ id: string }>(
    "SELECT id FROM admin_roles WHERE code = 'chat_stajer' LIMIT 1",
  );
  const internPrefix = await db.query<{ id: string }>(
    "SELECT id FROM admin_prefixes WHERE name = 'Стажёр' LIMIT 1",
  );

  // При одобрении выдаём «Стажёра» вместо администратора. Уже назначенную
  // вручную роль (модератор, поддержка и т.п.) не трогаем.
  const assignIntern =
    internRole.rows.length > 0 &&
    (target.role_code === null || target.role_code === 'administrator');
  const isIntern = target.role_code === 'chat_stajer' || assignIntern;
  const roleId = internRole.rows[0]?.id ?? null;
  const prefixId = internPrefix.rows[0]?.id ?? null;

  await db.query(
    `UPDATE admin_users
        SET status = 'approved',
            reviewed_at = CURRENT_TIMESTAMP(3),
            reviewed_by = ?,
            reviewed_by_login = ?,
            updated_at = CURRENT_TIMESTAMP(3),
            role_id = CASE WHEN ? THEN ? ELSE role_id END,
            role = CASE WHEN ? THEN 'admin' ELSE role END,
            prefix_id = CASE WHEN ? AND prefix_id IS NULL THEN ? ELSE prefix_id END
      WHERE id = ?`,
    [
      actor.sub,
      actor.login,
      assignIntern ? 1 : 0,
      roleId,
      assignIntern ? 1 : 0,
      isIntern ? 1 : 0,
      prefixId,
      id,
    ],
  );

  return getUserById(id);
}

export async function rejectUser(id: string, actor: AuthPayload): Promise<AdminUserDto> {
  const target = await getUserById(id);

  if (target.role === 'owner') {
    throw new HttpError(403, 'Нельзя отклонить заявку владельца');
  }

  if (target.id === actor.sub) {
    throw new HttpError(400, 'Нельзя отклонить собственную учётную запись');
  }

  if (target.is_system) {
    throw new HttpError(400, 'Системный аккаунт нельзя отклонить');
  }

  const db = await getDb();
  await db.query(
    `UPDATE admin_users
        SET status = 'rejected',
            reviewed_at = CURRENT_TIMESTAMP(3),
            reviewed_by = ?,
            reviewed_by_login = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [actor.sub, actor.login, id],
  );

  return getUserById(id);
}

export interface ChangeRoleResult {
  data: AdminUserDto;
  previous: AdminUserDto;
}

async function roleIdForLegacy(role: AdminRole): Promise<string | null> {
  const db = await getDb();
  const result = await db.query<{ id: string }>('SELECT id FROM admin_roles WHERE code = ?', [
    role === 'owner' ? 'owner' : 'administrator',
  ]);
  return result.rows[0]?.id ?? null;
}

/**
 * Быстрое переключение полного доступа (кнопка-корона).
 * Для гибких ролей используйте updateUserAccess.
 */
export async function changeUserRole(
  id: string,
  role: AdminRole,
  actor: AuthPayload,
): Promise<ChangeRoleResult> {
  const previous = await getUserById(id);

  if (previous.id === actor.sub) {
    throw new HttpError(400, 'Нельзя изменить собственную роль');
  }

  if (previous.is_system) {
    throw new HttpError(400, 'Системный аккаунт нельзя изменить');
  }

  if (previous.role === role) {
    throw new HttpError(
      409,
      role === 'owner' ? 'Этот аккаунт уже владелец' : 'Этот аккаунт уже администратор',
    );
  }

  if (role === 'owner' && previous.status !== 'approved') {
    throw new HttpError(400, 'Сначала одобрите заявку, затем выдавайте роль владельца');
  }

  const db = await getDb();
  await db.query(
    'UPDATE admin_users SET role = ?, role_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [role, await roleIdForLegacy(role), id],
  );

  return { data: await getUserById(id), previous };
}

export interface UserAccessInput {
  role_id: string | null;
  prefix_id: string | null;
}

/**
 * Гибкое назначение роли и префикса. role_id = null означает «роль не задана»:
 * такой администратор видит только разделы, разрешённые публично.
 */
export async function updateUserAccess(
  id: string,
  input: UserAccessInput,
  actor: AuthPayload,
): Promise<ChangeRoleResult> {
  const previous = await getUserById(id);

  if (previous.is_system) {
    throw new HttpError(400, 'Системный аккаунт нельзя изменить');
  }

  // Свой префикс менять можно, роль — нет: иначе можно обойти правила повышения.
  if (previous.id === actor.sub && input.role_id !== previous.role_id) {
    throw new HttpError(403, 'Нельзя изменить собственную роль — попросите другого владельца');
  }

  const db = await getDb();
  let roleCode: string | null = null;

  if (input.role_id) {
    const role = await db.query<{ code: string }>('SELECT code FROM admin_roles WHERE id = ?', [
      input.role_id,
    ]);

    if (!role.rows[0]) {
      throw new HttpError(400, 'Роль не найдена');
    }

    roleCode = role.rows[0].code;

    if (roleCode === 'owner' && actor.role !== 'owner') {
      throw new HttpError(403, 'Назначать владельца может только владелец');
    }
  }

  if (input.prefix_id) {
    const prefix = await db.query<{ id: string }>('SELECT id FROM admin_prefixes WHERE id = ?', [
      input.prefix_id,
    ]);

    if (!prefix.rows[0]) {
      throw new HttpError(400, 'Префикс не найден');
    }
  }

  if (previous.role === 'owner' && actor.role !== 'owner') {
    throw new HttpError(403, 'Менять доступ владельца может только владелец');
  }

  await db.query(
    `UPDATE admin_users
        SET role_id = ?,
            prefix_id = ?,
            role = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [input.role_id, input.prefix_id, roleCode === 'owner' ? 'owner' : 'admin', id],
  );

  return { data: await getUserById(id), previous };
}

export async function deleteUser(id: string, actor: AuthPayload): Promise<AdminUserDto> {
  const target = await getUserById(id);

  if (target.role === 'owner' || target.is_system) {
    throw new HttpError(403, 'Нельзя удалить владельца или системный аккаунт');
  }

  if (target.id === actor.sub) {
    throw new HttpError(400, 'Нельзя удалить собственную учётную запись');
  }

  const db = await getDb();
  await db.query('DELETE FROM admin_users WHERE id = ?', [id]);

  return target;
}
