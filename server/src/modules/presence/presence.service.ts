import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';

export interface OnlineAdminDto {
  id: string;
  login: string;
  role_name: string | null;
  prefix: { id: string; name: string; color: string; is_shiny: boolean } | null;
  avatar_url: string | null;
  last_seen_at: string;
}

interface OnlineAdminRow {
  id: string;
  login: string;
  avatar_url: string;
  last_seen_at: Date | string;
  role_name: string | null;
  prefix_id: string | null;
  prefix_name: string | null;
  prefix_color: string | null;
  prefix_is_shiny: boolean | number | null;
}

/** Окно присутствия: администратор считается онлайн 10 минут после запроса. */
export const PRESENCE_WINDOW_MINUTES = 10;

export async function listOnlineAdmins(): Promise<OnlineAdminDto[]> {
  const db = await getDb();
  const result = await db.query<OnlineAdminRow>(
    `SELECT u.id,
            u.login,
            u.avatar_url,
            u.last_seen_at,
            r.name AS role_name,
            u.prefix_id,
            p.name AS prefix_name,
            p.color AS prefix_color,
            p.is_shiny AS prefix_is_shiny
       FROM admin_users AS u
       LEFT JOIN admin_roles AS r ON r.id = u.role_id
       LEFT JOIN admin_prefixes AS p ON p.id = u.prefix_id
      WHERE u.status = 'approved'
        AND u.is_system = FALSE
        AND u.last_seen_at IS NOT NULL
        AND u.last_seen_at >= CURRENT_TIMESTAMP(3) - INTERVAL ${PRESENCE_WINDOW_MINUTES} MINUTE
      ORDER BY p.priority IS NULL, p.priority DESC, u.login ASC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    login: row.login,
    avatar_url: row.avatar_url || null,
    role_name: row.role_name,
    prefix:
      row.prefix_id && row.prefix_name && row.prefix_color
        ? {
            id: row.prefix_id,
            name: row.prefix_name,
            color: row.prefix_color,
            is_shiny: Boolean(row.prefix_is_shiny),
          }
        : null,
    last_seen_at: toIso(row.last_seen_at),
  }));
}
