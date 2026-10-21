export type AuditGroup =
  | 'resources'
  | 'categories'
  | 'users'
  | 'access'
  | 'import'
  | 'support'
  | 'news'
  | 'auth';
export type AuditPeriod = '24h' | '7d' | '30d' | 'all';

/** Кто выполнил действие. Для неудачного входа логин может быть «чужим». */
export interface AuditActor {
  id: string | null;
  login: string;
}

export interface AuditRecordInput {
  action: string;
  actor: AuditActor;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown> | null;
}

export interface AuditLogRow {
  id: string;
  created_at: Date | string;
  user_id: string | null;
  user_login: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: unknown;
  ip: string | null;
  user_agent: string | null;
  user_avatar_url: string | null;
  total_count?: number | string;
}

export interface AuditLogDto {
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

export interface ListAuditQuery {
  group?: AuditGroup;
  period: AuditPeriod;
  user_id?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface AuditListResult {
  data: AuditLogDto[];
  total: number;
}
