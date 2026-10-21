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
       JOIN admin_roles AS r
         ON (u.role = 'owner' AND r.code = 'owner')
         OR (u.role <> 'owner' AND r.code = 'administrator')
        SET u.role_id = r.id
      WHERE u.role_id IS NULL`,
  );

  await db.query(
    `UPDATE admin_users AS u
       JOIN admin_prefixes AS p
         ON (u.role = 'owner' AND p.name = 'Владелец')
         OR (u.role <> 'owner' AND p.name = 'Администратор')
        SET u.prefix_id = p.id
      WHERE u.prefix_id IS NULL`,
  );

  // Восстановление включается явно в Environment сервиса Render.
  // Журнал служит отметкой выполнения: повторный запуск не сбрасывает пароль.
  const recoveryLogin = process.env.ADMIN_RECOVERY_LOGIN?.trim();
  if (recoveryLogin) {
    const completed = await db.query(
      `SELECT id FROM audit_log WHERE action = 'auth.owner_recovered'
       AND entity_label = ? LIMIT 1`,
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

      const passwordHash = await hashPassword(password);

      // Изменение аккаунта и запись в журнал выполняются атомарно.
      await db.transaction(async (tx) => {
        const target = await tx.query<{ id: string; login: string }>(
          'SELECT id, login FROM admin_users WHERE login = ? AND is_system = FALSE LIMIT 1',
          [recoveryLogin],
        );
        const user = target.rows[0];

        if (!user) {
          throw new Error('Не найден неслужебный аккаунт для восстановления');
        }

        await tx.query(
          `UPDATE admin_users
              SET role = 'owner',
                  status = 'approved',
                  role_id = ?,
                  prefix_id = ?,
                  password_hash = ?,
                  reviewed_at = CURRENT_TIMESTAMP(3),
                  reviewed_by = NULL,
                  reviewed_by_login = 'deployment recovery',
                  updated_at = CURRENT_TIMESTAMP(3),
                  password_changed_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?`,
          [roleId, prefixId, passwordHash, user.id],
        );

        await tx.query(
          `INSERT INTO audit_log
             (id, user_id, user_login, action, entity_type, entity_id, entity_label)
           VALUES (?, ?, 'deployment recovery', 'auth.owner_recovered', 'user', ?, ?)`,
          [randomUUID(), user.id, user.id, user.login],
        );
      });

      logger.info('Восстановлен доступ владельца; удалите ADMIN_RECOVERY_LOGIN из Environment');
    }
  }

  const existing = await db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM admin_users WHERE is_system = FALSE',
  );

  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  await db.query(
    `INSERT INTO admin_users
       (id, login, password_hash, role, status, reviewed_at, role_id, prefix_id)
     VALUES (?, ?, ?, 'owner', 'approved', CURRENT_TIMESTAMP(3), ?, ?)`,
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
