import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import { normalizePermissions, type PermissionKey } from './permissions.js';
import type {
  CreatePrefixInput,
  CreateRoleInput,
  UpdatePrefixInput,
  UpdateRoleInput,
} from './access.schema.js';

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  /** Уровень доступа роли: чем выше, тем больше разделов открыто. */
  access_level: number;
  is_system: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface PrefixDto {
  id: string;
  name: string;
  color: string;
  priority: number;
  /** Включён «shiny»-эффект: по тексту префикса бежит светлая полоса. */
  is_shiny: boolean;
  is_system: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: unknown;
  access_level: number | string;
  is_system: boolean | number;
  user_count?: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PrefixRow {
  id: string;
  name: string;
  color: string;
  priority: number | string;
  is_shiny: boolean | number;
  is_system: boolean | number;
  user_count?: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

function toRoleDto(row: RoleRow): RoleDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    permissions: normalizePermissions(row.permissions),
    access_level: Number(row.access_level ?? 0),
    is_system: Boolean(row.is_system),
    user_count: Number(row.user_count ?? 0),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toPrefixDto(row: PrefixRow): PrefixDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    priority: Number(row.priority ?? 0),
    is_shiny: Boolean(row.is_shiny),
    is_system: Boolean(row.is_system),
    user_count: Number(row.user_count ?? 0),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

const ROLE_SELECT = `
  SELECT r.id, r.code, r.name, r.description, r.permissions, r.is_system,
         r.access_level, r.created_at, r.updated_at,
         (SELECT COUNT(*) FROM admin_users AS u
           WHERE u.role_id = r.id AND u.is_system = FALSE) AS user_count
    FROM admin_roles AS r
`;

const PREFIX_SELECT = `
  SELECT p.id, p.name, p.color, p.priority, p.is_shiny, p.is_system,
         p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM admin_users AS u
           WHERE u.prefix_id = p.id AND u.is_system = FALSE) AS user_count
    FROM admin_prefixes AS p
`;

export async function listRoles(): Promise<RoleDto[]> {
  const db = await getDb();
  const result = await db.query<RoleRow>(
    `${ROLE_SELECT}
     ORDER BY CASE WHEN r.code = 'owner' THEN 0 ELSE 1 END, r.is_system DESC, r.name ASC`,
  );

  return result.rows.map(toRoleDto);
}

async function getRoleById(id: string): Promise<RoleDto> {
  const db = await getDb();
  const result = await db.query<RoleRow>(`${ROLE_SELECT} WHERE r.id = ?`, [id]);
  const row = result.rows[0];

  if (!row) throw new HttpError(404, 'Роль не найдена');

  return toRoleDto(row);
}

export async function createRole(input: CreateRoleInput): Promise<RoleDto> {
  const db = await getDb();
  const code = input.code.trim().toLowerCase();

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM admin_roles WHERE code = ? OR name = ?',
    [code, input.name],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Роль с таким кодом или названием уже существует');
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO admin_roles (id, code, name, description, permissions, access_level, is_system)
     VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
    [
      id,
      code,
      input.name,
      input.description,
      JSON.stringify(normalizePermissions(input.permissions)),
      input.access_level,
    ],
  );

  return getRoleById(id);
}

export interface RoleUpdateResult {
  data: RoleDto;
  previous: RoleDto;
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleUpdateResult> {
  const previous = await getRoleById(id);

  if (previous.code === 'owner') {
    throw new HttpError(403, 'Роль владельца изменить нельзя');
  }

  const db = await getDb();

  if (input.name && input.name.toLowerCase() !== previous.name.toLowerCase()) {
    const duplicate = await db.query<{ id: string }>(
      'SELECT id FROM admin_roles WHERE name = ? AND id <> ?',
      [input.name, id],
    );

    if (duplicate.rows.length > 0) {
      throw new HttpError(409, 'Роль с таким названием уже существует');
    }
  }

  await db.query(
    `UPDATE admin_roles
        SET name = ?,
            description = ?,
            permissions = ?,
            access_level = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [
      input.name ?? previous.name,
      input.description !== undefined ? input.description : previous.description,
      JSON.stringify(
        normalizePermissions(input.permissions ?? (previous.permissions as PermissionKey[])),
      ),
      input.access_level ?? previous.access_level,
      id,
    ],
  );

  return { data: await getRoleById(id), previous };
}

export async function deleteRole(id: string): Promise<RoleDto> {
  const existing = await getRoleById(id);

  if (existing.is_system) {
    throw new HttpError(403, 'Системную роль удалить нельзя');
  }

  const db = await getDb();
  await db.query('DELETE FROM admin_roles WHERE id = ?', [id]);

  return existing;
}

// ── Префиксы ─────────────────────────────────────────────────

export async function listPrefixes(): Promise<PrefixDto[]> {
  const db = await getDb();
  const result = await db.query<PrefixRow>(
    `${PREFIX_SELECT}
     ORDER BY p.priority DESC, p.name ASC`,
  );

  return result.rows.map(toPrefixDto);
}

async function getPrefixById(id: string): Promise<PrefixDto> {
  const db = await getDb();
  const result = await db.query<PrefixRow>(`${PREFIX_SELECT} WHERE p.id = ?`, [id]);
  const row = result.rows[0];

  if (!row) throw new HttpError(404, 'Префикс не найден');

  return toPrefixDto(row);
}

export async function createPrefix(input: CreatePrefixInput): Promise<PrefixDto> {
  const db = await getDb();
  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM admin_prefixes WHERE name = ?',
    [input.name],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Префикс с таким названием уже существует');
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO admin_prefixes (id, name, color, priority, is_shiny, is_system)
     VALUES (?, ?, ?, ?, ?, FALSE)`,
    [id, input.name, input.color, input.priority, input.is_shiny],
  );

  return getPrefixById(id);
}

export interface PrefixUpdateResult {
  data: PrefixDto;
  previous: PrefixDto;
}

export async function updatePrefix(
  id: string,
  input: UpdatePrefixInput,
): Promise<PrefixUpdateResult> {
  const previous = await getPrefixById(id);
  const db = await getDb();

  if (input.name && input.name.toLowerCase() !== previous.name.toLowerCase()) {
    const duplicate = await db.query<{ id: string }>(
      'SELECT id FROM admin_prefixes WHERE name = ? AND id <> ?',
      [input.name, id],
    );

    if (duplicate.rows.length > 0) {
      throw new HttpError(409, 'Префикс с таким названием уже существует');
    }
  }

  await db.query(
    `UPDATE admin_prefixes
        SET name = ?,
            color = ?,
            priority = ?,
            is_shiny = ?,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [
      input.name ?? previous.name,
      input.color ?? previous.color,
      input.priority ?? previous.priority,
      input.is_shiny ?? previous.is_shiny,
      id,
    ],
  );

  return { data: await getPrefixById(id), previous };
}

export async function deletePrefix(id: string): Promise<PrefixDto> {
  const existing = await getPrefixById(id);

  if (existing.is_system) {
    throw new HttpError(403, 'Системный префикс удалить нельзя');
  }

  const db = await getDb();
  await db.query('DELETE FROM admin_prefixes WHERE id = ?', [id]);

  return existing;
}
