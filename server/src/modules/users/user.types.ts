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
  created_at: Date | string;
  updated_at: Date | string;
  password_changed_at: Date | string;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  last_login_at: Date | string | null;
  last_seen_at: Date | string | null;
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
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_login: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
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
