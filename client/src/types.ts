export interface Resource {
  id: string;
  name: string;
  /** HEX-цвет названия (#RRGGBB) из Minecraft-кодов; null — цвет темы по умолчанию. */
  name_color: string | null;
  min_price: number;
  image_url: string;
  category_id: string | null;
  /** Название категории для отображения («Без категории» при category_id = null). */
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceInput {
  name: string;
  name_color: string | null;
  min_price: number;
  image_url: string;
  category_id: string | null;
}

export interface ResourceStats {
  total: number;
  min_price: number | null;
  avg_price: number | null;
  most_expensive: { name: string; min_price: number } | null;
  categories: Array<{ id: string; name: string; count: number }>;
}

export interface Category {
  id: string;
  name: string;
  resource_count: number;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  token_type: 'Bearer';
  expires_in: string;
  user: AdminUser;
}

export type AdminRole = 'owner' | 'admin';
export type AdminStatus = 'pending' | 'approved' | 'rejected';

export interface AdminPrefix {
  id: string;
  name: string;
  color: string;
}

export interface AdminUser {
  id: string;
  login: string;
  role: AdminRole;
  status: AdminStatus;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  permissions: string[];
  prefix: AdminPrefix | null;
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
}

export interface AdminUserCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface RegisterResponse {
  login: string;
  status: AdminStatus;
  created_at: string;
}

export type AuditGroup =
  | 'resources'
  | 'categories'
  | 'users'
  | 'access'
  | 'import'
  | 'support'
  | 'auth';
export type AuditPeriod = '24h' | '7d' | '30d' | 'all';

/** Действие администратора из журнала. */
export interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_login: string;
  user_avatar_url: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
}

export interface AuditLogMeta {
  total: number;
  count: number;
  limit: number;
  offset: number;
}

export type ResourceSort = 'name_asc' | 'price_asc' | 'price_desc' | 'newest';

export interface ApiMeta {
  total: number;
  count: number;
  page?: number;
  limit?: number;
  pages?: number;
}

export interface TradeLineInput {
  resource_id: string;
  quantity: number;
}

export interface TradeCalculationInput {
  side_a: TradeLineInput[];
  side_b: TradeLineInput[];
}

export interface TradeLineResult {
  resource_id: string;
  name: string;
  image_url: string;
  category: string;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface TradeSideResult {
  lines: TradeLineResult[];
  total: number;
  items_count: number;
  total_quantity: number;
}

export type TradeFavoredSide = 'a' | 'b' | 'balanced';

export interface TradeCalculationResult {
  side_a: TradeSideResult;
  side_b: TradeSideResult;
  delta: number;
  favored_side: TradeFavoredSide;
  ratio: number | null;
}

// ── RBAC ─────────────────────────────────────────────────────

export interface PermissionMeta {
  key: string;
  group: string;
  label: string;
}

export interface AdminRoleInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminPrefixInfo {
  id: string;
  name: string;
  color: string;
  priority: number;
  is_system: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface OnlineAdmin {
  id: string;
  login: string;
  role_name: string | null;
  prefix: AdminPrefix | null;
  avatar_url: string | null;
  last_seen_at: string;
}

// ── Обращения ────────────────────────────────────────────────

export type TicketKind = 'item' | 'price' | 'error' | 'other';
export type TicketStatus = 'new' | 'in_progress' | 'answered' | 'closed';

export interface SupportTicket {
  id: string;
  ticket_no: number;
  kind: TicketKind;
  nick: string;
  discord: string;
  target: string | null;
  message: string;
  status: TicketStatus;
  admin_reply: string | null;
  replied_by: string | null;
  replied_by_login: string | null;
  replied_by_avatar_url: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  ip: string | null;
  user_agent: string | null;
}

export interface TicketCounts {
  total: number;
  new: number;
  in_progress: number;
  answered: number;
  closed: number;
}

export interface ReportInput {
  kind: TicketKind;
  nick: string;
  discord: string;
  target: string;
  message: string;
}

// ── Импорт ───────────────────────────────────────────────────

export interface ImportJob {
  id: string;
  actor_login: string;
  actor_avatar_url: string | null;
  status: 'running' | 'done' | 'failed';
  source_name: string | null;
  total_items: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  image_count: number;
  error_count: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
}

export interface ImportSummary {
  job_id: string;
  status: 'done';
  total: number;
  created: number;
  updated: number;
  skipped: number;
  images: number;
  errors: string[];
}
