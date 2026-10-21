import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import { normalizePermissions } from '../rbac/permissions.js';
import type {
  AdminRole,
  AdminUserBaseRow,
  AdminUserDto,
  AdminUserRow,
  ListUsersQuery,
  SessionUser,
  UserCounts,
} from './user.types.js';

type UserRowWithRelations = AdminUserBaseRow & {
  reviewed_by_login: string | null;
  role_code: string | null;
  role_name: string | null;
  role_permissions: unknown;
  prefix_name: string | null;
  prefix_color: string | null;
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
         u.created_at,
         u.updated_at,
         u.reviewed_at,
         u.reviewed_by,
         u.last_login_at,
         u.last_seen_at,
         -- Снимок логина ревьюера важнее JOIN: он переживает удаление администратора.
         COALESCE(u.reviewed_by_login, reviewer.login) AS reviewed_by_login,
         r.code AS role_code,
         r.name AS role_name,
         r.permissions AS role_permissions,
         p.name AS prefix_name,
         p.color AS prefix_color
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
    permissions: normalizePermissions(row.role_permissions),
    prefix:
      row.prefix_id && row.prefix_name && row.prefix_color
        ? { id: row.prefix_id, name: row.prefix_name, color: row.prefix_color }
        : null,
    is_system: Boolean(row.is_system),
    discord: row.discord,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    reviewed_at: row.reviewed_at ? toIso(row.reviewed_at) : null,
    reviewed_by: row.reviewed_by,
    reviewed_by_login: row.reviewed_by_login ?? null,
    last_login_at: row.last_login_at ? toIso(row.last_login_at) : null,
    last_seen_at: row.last_seen_at ? toIso(row.last_seen_at) : null,
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
            p.color AS prefix_color
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

  return toDto(row);
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

/** Создаёт заявку на доступ: аккаунт сразу есть, но вход заблокирован до одобрения. */
export async function createPendingUser(login: string, passwordHash: string): Promise<AdminUserDto> {
  const db = await getDb();

  const duplicate = await db.query<{ id: string }>('SELECT id FROM admin_users WHERE login = ?', [
    login,
  ]);

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Такой логин уже занят');
  }

  const role = await db.query<{ id: string }>(
    "SELECT id FROM admin_roles WHERE code = 'administrator'",
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
  await db.query(
    `UPDATE admin_users
        SET last_login_at = CURRENT_TIMESTAMP(3), last_seen_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [id],
  );
}

/**
 * Отметка присутствия. Пишем не чаще раза в минуту на администратора:
 * иначе каждый запрос к API превращался бы в UPDATE.
 */
export async function touchPresence(id: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE admin_users
        SET last_seen_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
        AND (last_seen_at IS NULL OR last_seen_at < CURRENT_TIMESTAMP(3) - INTERVAL 60 SECOND)`,
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

export async function approveUser(id: string, actor: AuthPayload): Promise<AdminUserDto> {
  const target = await getUserById(id);

  if (target.is_system) {
    throw new HttpError(400, 'Системный аккаунт нельзя одобрять вручную');
  }

  const db = await getDb();

  await db.query(
    `UPDATE admin_users
        SET status = 'approved',
            reviewed_at = CURRENT_TIMESTAMP(3),
            reviewed_by = ?,
            reviewed_by_login = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [actor.sub, actor.login, id],
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

  if (previous.id === actor.sub) {
    throw new HttpError(400, 'Нельзя изменить собственный доступ');
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
