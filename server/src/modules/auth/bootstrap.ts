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

  // Восстановление включается явно в Environment сервиса Render.
  // Журнал служит отметкой выполнения: повторный запуск не сбрасывает пароль.
  const recoveryLogin = process.env.ADMIN_RECOVERY_LOGIN?.trim();
  if (recoveryLogin) {
    const completed = await db.query(
      `SELECT id FROM audit_log WHERE action = 'auth.owner_recovered'
       AND LOWER(entity_label) = LOWER($1) LIMIT 1`,
      [recoveryLogin],
    );
    if (completed.rows.length === 0) {
      const password = process.env.ADMIN_PASSWORD;
      if (!password || password.length < 12) {
        throw new Error('Для восстановления задайте ADMIN_PASSWORD длиной минимум 12 символов');
      }
      if (!roleId || !prefixId) {
        throw new Error('Не найдена роль или префикс владельца');
      }
      // Изменение аккаунта и запись в журнал выполняются атомарно.
      const recovered = await db.query<{ login: string }>(
        `WITH recovered AS (
           UPDATE admin_users
           SET role = 'owner', status = 'approved', role_id = $1,
               prefix_id = $2, password_hash = $3,
               reviewed_at = NOW(), reviewed_by = NULL,
               reviewed_by_login = 'deployment recovery',
               updated_at = NOW(), password_changed_at = NOW()
           WHERE LOWER(login) = LOWER($4) AND is_system = FALSE
           RETURNING id, login
         ), logged AS (
           INSERT INTO audit_log
             (id, user_id, user_login, action, entity_type, entity_id, entity_label)
           SELECT $5, id, 'deployment recovery', 'auth.owner_recovered',
                  'user', id::text, login FROM recovered
           RETURNING id
         )
         SELECT login FROM recovered WHERE EXISTS (SELECT 1 FROM logged)`,
        [roleId, prefixId, await hashPassword(password), recoveryLogin, randomUUID()],
      );
      if (recovered.rows.length !== 1) {
        throw new Error('Не найден неслужебный аккаунт для восстановления');
      }
      logger.info('Восстановлен доступ владельца; удалите ADMIN_RECOVERY_LOGIN из Environment');
    }
  }

  const existing = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM admin_users WHERE is_system = FALSE',
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
