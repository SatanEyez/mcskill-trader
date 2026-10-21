export type AdminRole = 'owner' | 'admin';
export type AdminStatus = 'pending' | 'approved' | 'rejected';

export interface AdminPrefixDto {
  id: string;
  name: string;
  color: string;
}

export interface AdminRoleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRow {
  id: string;
  login: string;
  password_hash: string;
  role: AdminRole;
  status: AdminStatus;
  role_id: string | null;
  prefix_id: string | null;
  is_system: boolean;
  discord: string | null;
  avatar_url: string;
  created_at: Date | string;
  updated_at: Date | string;
  password_changed_at: Date | string;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  last_login_at: Date | string | null;
  last_seen_at: Date | string | null;
  online_seconds: number | string;
  session_started_at: Date | string | null;
}

export type AdminUserBaseRow = Omit<AdminUserRow, 'password_hash'>;

export interface AdminUserDto {
  id: string;
  login: string;
  role: AdminRole;
  status: AdminStatus;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  permissions: string[];
  prefix: AdminPrefixDto | null;
  is_system: boolean;
  discord: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_login: string | null;
  /** Кто последним менял роль и префикс (из журнала действий). */
  role_assigned_by_login: string | null;
  role_assigned_at: string | null;
  prefix_assigned_by_login: string | null;
  prefix_assigned_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  /** Накопленное время в сети за всё время, секунды. */
  online_seconds: number;
  /** Начало текущей непрерывной сессии; null — сессии ещё не было. */
  session_started_at: string | null;
  /** Был в панели последние 10 минут. */
  is_online: boolean;
}

/** Сводка по полному списку администрации. */
export interface StaffSummary {
  total: number;
  online: number;
  total_online_seconds: number;
}

/** Минимальные данные для проверки сессии в requireAdmin. */
export interface SessionUser {
  id: string;
  login: string;
  role: AdminRole;
  status: AdminStatus;
  password_hash: string;
  role_code: string | null;
  role_name: string | null;
  permissions: unknown;
  prefix_id: string | null;
  prefix_name: string | null;
  prefix_color: string | null;
  is_system: boolean;
}

export interface UserCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface ListUsersQuery {
  status?: AdminStatus;
}
