import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { hashPassword } from './password.js';

/**
 * Первый администратор создаётся из ADMIN_LOGIN / ADMIN_PASSWORD.
 * Дальше аккаунты появляются через регистрацию и одобрение в панели.
 * Роль и префикс берём из RBAC-справочников (миграция 006).
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const db = await getDb();

  const role = await db.query<{ id: string }>(
    "SELECT id FROM admin_roles WHERE code = 'owner' LIMIT 1",
  );
  const prefix = await db.query<{ id: string }>(
    "SELECT id FROM admin_prefixes WHERE name = 'Владелец' LIMIT 1",
  );

  const roleId = role.rows[0]?.id ?? null;
  const prefixId = prefix.rows[0]?.id ?? null;

  // Догоняем старые строки, созданные до появления RBAC.
  await db.query(
    `UPDATE admin_users AS u
        SET role_id = r.id
       FROM admin_roles AS r
      WHERE u.role_id IS NULL
        AND ((u.role = 'owner' AND r.code = 'owner')
          OR (u.role <> 'owner' AND r.code = 'administrator'))`,
  );

  await db.query(
    `UPDATE admin_users AS u
        SET prefix_id = p.id
       FROM admin_prefixes AS p
      WHERE u.prefix_id IS NULL
        AND ((u.role = 'owner' AND p.name = 'Владелец')
          OR (u.role <> 'owner' AND p.name = 'Администратор'))`,
  );

  const existing = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM admin_users',
  );

  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  await db.query(
    `INSERT INTO admin_users
       (id, login, password_hash, role, status, reviewed_at, role_id, prefix_id)
     VALUES ($1, $2, $3, 'owner', 'approved', NOW(), $4, $5)`,
    [
      randomUUID(),
      env.ADMIN_LOGIN,
      await hashPassword(env.ADMIN_PASSWORD),
      roleId,
      prefixId,
    ],
  );

  logger.info(
    `Создан владелец админ-панели «${env.ADMIN_LOGIN}» (пароль взят из ADMIN_PASSWORD)`,
  );
}
