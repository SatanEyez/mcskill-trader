import type {
  AdminPrefixInfo,
  AdminRoleInfo,
  AdminRole,
  AdminStatus,
  AdminUser,
  AdminUserCounts,
  ApiMeta,
  AuditGroup,
  AuditLogEntry,
  AuditLogMeta,
  AuditPeriod,
  Category,
  ExcludedResource,
  ImportJob,
  ImportSummary,
  LoginResponse,
  NewsInput,
  NewsPost,
  OnlineAdmin,
  PermissionMeta,
  RegisterResponse,
  ReportInput,
  Resource,
  ResourceInput,
  ResourceSort,
  ResourceStats,
  SupportTicket,
  TicketCounts,
  TicketKind,
  TicketStatus,
  TradeCalculationInput,
  TradeCalculationResult,
  VisitPeriod,
  VisitStats,
  VisitorEntry,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
const TOKEN_STORAGE_KEY = 'mcskill.trader.token';

export const AUTH_EXPIRED_EVENT = 'mcskill:auth-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Приватный режим браузера может запрещать localStorage — сессия проживёт до перезагрузки.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getStoredToken();

    if (!token) {
      throw new ApiError('Для доступа нужна авторизация', 401);
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что API запущено.', 0);
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as
      | { error?: { message?: string; details?: unknown } }
      | null;

    if (response.status === 401 && auth) {
      clearStoredToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(
      errorBody?.error?.message ?? `Ошибка запроса (${response.status})`,
      response.status,
      errorBody?.error?.details,
    );
  }

  return payload as T;
}

export interface UploadedImage {
  /** Путь вида `/uploads/<uuid>.png` — его кладём в `image_url`. */
  url: string;
  filename: string;
  mime: string;
  size: number;
}

/**
 * Загрузка изображения с компьютера (multipart/form-data, поле `image`).
 * Content-Type не задаём — браузер сам подставит boundary.
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const token = getStoredToken();

  if (!token) {
    throw new ApiError('Для доступа нужна авторизация', 401);
  }

  const body = new FormData();
  body.append('image', file);

  let response: Response;

  try {
    response = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что API запущено.', 0);
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as { error?: { message?: string; details?: unknown } } | null;

    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(
      errorBody?.error?.message ?? `Не удалось загрузить изображение (${response.status})`,
      response.status,
      errorBody?.error?.details,
    );
  }

  return (payload as { data: UploadedImage }).data;
}

/**
 * Аватар своего профиля (multipart, поле `avatar`, до 2 МБ).
 * Файл хранится в базе, поэтому переживает деплой.
 */
export async function uploadAvatar(file: File): Promise<AdminUser> {
  const token = getStoredToken();

  if (!token) {
    throw new ApiError('Для доступа нужна авторизация', 401);
  }

  const body = new FormData();
  body.append('avatar', file);

  let response: Response;

  try {
    response = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'PUT',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что API запущено.', 0);
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as { error?: { message?: string; details?: unknown } } | null;

    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(
      errorBody?.error?.message ?? `Не удалось загрузить аватар (${response.status})`,
      response.status,
      errorBody?.error?.details,
    );
  }

  return (payload as { data: AdminUser }).data;
}

export async function deleteAvatar(): Promise<AdminUser> {
  const payload = await request<{ data: AdminUser }>('/users/me/avatar', {
    method: 'DELETE',
    auth: true,
  });

  return payload.data;
}

interface ResourceListParams {
  search?: string;
  category_id?: string;
  sort?: ResourceSort;
  page?: number;
  limit?: number;
}

export async function fetchResources(
  params: ResourceListParams = {},
): Promise<{ data: Resource[]; meta: ApiMeta }> {
  const query = new URLSearchParams();

  if (params.search) query.set('search', params.search);
  if (params.category_id) query.set('category_id', params.category_id);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<{ data: Resource[]; meta: ApiMeta }>(`/resources${suffix}`);
}

/** Полный каталог для трейд-калькулятора (9k+ строк, один запрос). */
export async function fetchCatalog(): Promise<Resource[]> {
  const response = await request<{ data: Resource[]; meta: ApiMeta }>('/resources/catalog');
  return response.data;
}

export async function fetchResourceStats(): Promise<ResourceStats> {
  const response = await request<{ data: ResourceStats }>('/resources/stats');
  return response.data;
}

export async function fetchResource(id: string): Promise<Resource> {
  const response = await request<{ data: Resource }>(`/resources/${encodeURIComponent(id)}`);
  return response.data;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await request<{ data: Category[] }>('/categories');
  return response.data;
}

export async function createCategory(name: string): Promise<Category> {
  const response = await request<{ data: Category }>('/categories', {
    method: 'POST',
    body: { name },
    auth: true,
  });
  return response.data;
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const response = await request<{ data: Category }>(`/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { name },
    auth: true,
  });
  return response.data;
}

export async function deleteCategory(
  id: string,
): Promise<{ id: string; moved_resources: number }> {
  const response = await request<{ data: { id: string; moved_resources: number } }>(
    `/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE', auth: true },
  );
  return response.data;
}

export async function createResource(input: ResourceInput): Promise<Resource> {
  const response = await request<{ data: Resource }>('/resources', {
    method: 'POST',
    body: input,
    auth: true,
  });
  return response.data;
}

export async function updateResource(id: string, input: Partial<ResourceInput>): Promise<Resource> {
  const response = await request<{ data: Resource }>(`/resources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    auth: true,
  });
  return response.data;
}

export async function deleteResource(id: string): Promise<void> {
  await request<{ data: { id: string } }>(`/resources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

/** Массовое удаление: предметы попадают в стоп-лист импорта, как при одиночном удалении. */
export async function deleteResources(
  ids: string[],
): Promise<{ deleted: string[]; count: number }> {
  const response = await request<{ data: { deleted: string[]; count: number } }>(
    '/resources/bulk-delete',
    { method: 'POST', body: { ids }, auth: true },
  );
  return response.data;
}

/** Удалённые предметы: импорт прайса их пропускает, пока запись не убрать. */
export async function fetchExcludedResources(): Promise<ExcludedResource[]> {
  const response = await request<{ data: ExcludedResource[] }>('/resources/exclusions', {
    auth: true,
  });
  return response.data;
}

export async function restoreExcludedResource(id: string): Promise<Resource> {
  const response = await request<{ data: Resource }>(
    `/resources/exclusions/${encodeURIComponent(id)}/restore`,
    { method: 'POST', auth: true },
  );
  return response.data;
}

export async function login(login: string, password: string): Promise<LoginResponse> {
  const response = await request<{ data: LoginResponse }>('/auth/login', {
    method: 'POST',
    body: { login, password },
  });
  return response.data;
}

export async function register(login: string, password: string): Promise<RegisterResponse> {
  const response = await request<{ data: RegisterResponse }>('/auth/register', {
    method: 'POST',
    body: { login, password },
  });
  return response.data;
}

export async function fetchMe(): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>('/auth/me', { auth: true });
  return response.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResponse> {
  const response = await request<{ data: LoginResponse }>('/auth/password', {
    method: 'POST',
    auth: true,
    body: { current_password: currentPassword, new_password: newPassword },
  });
  return response.data;
}

export async function fetchUsers(
  status?: AdminStatus | 'all',
): Promise<{ data: AdminUser[]; meta: AdminUserCounts }> {
  const suffix = status && status !== 'all' ? `?status=${status}` : '';
  return request<{ data: AdminUser[]; meta: AdminUserCounts }>(`/users${suffix}`, { auth: true });
}

export async function approveUser(id: string): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>(
    `/users/${encodeURIComponent(id)}/approve`,
    { method: 'POST', auth: true },
  );
  return response.data;
}

export async function rejectUser(id: string): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>(`/users/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    auth: true,
  });
  return response.data;
}

export async function deleteUser(id: string): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
  return response.data;
}

/** Смена роли доступна только владельцу (проверяет сервер). */
export async function changeUserRole(id: string, role: AdminRole): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>(`/users/${encodeURIComponent(id)}/role`, {
    method: 'PUT',
    auth: true,
    body: { role },
  });
  return response.data;
}

/** Гибкое назначение RBAC-роли и префикса. */
export async function updateUserAccess(
  id: string,
  input: { role_id: string | null; prefix_id: string | null },
): Promise<AdminUser> {
  const response = await request<{ data: AdminUser }>(`/users/${encodeURIComponent(id)}/access`, {
    method: 'PUT',
    auth: true,
    body: input,
  });
  return response.data;
}

// ── RBAC ─────────────────────────────────────────────────────

export async function fetchRoles(): Promise<{
  data: AdminRoleInfo[];
  meta: { permissions: PermissionMeta[] };
}> {
  return request<{ data: AdminRoleInfo[]; meta: { permissions: PermissionMeta[] } }>('/roles', {
    auth: true,
  });
}

export async function createRole(input: {
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}): Promise<AdminRoleInfo> {
  const response = await request<{ data: AdminRoleInfo }>('/roles', {
    method: 'POST',
    auth: true,
    body: input,
  });
  return response.data;
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string | null; permissions?: string[] },
): Promise<AdminRoleInfo> {
  const response = await request<{ data: AdminRoleInfo }>(`/roles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    auth: true,
    body: input,
  });
  return response.data;
}

export async function deleteRole(id: string): Promise<void> {
  await request<{ data: AdminRoleInfo }>(`/roles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchPrefixes(): Promise<AdminPrefixInfo[]> {
  const response = await request<{ data: AdminPrefixInfo[] }>('/prefixes', { auth: true });
  return response.data;
}

export async function createPrefix(input: {
  name: string;
  color: string;
  priority: number;
}): Promise<AdminPrefixInfo> {
  const response = await request<{ data: AdminPrefixInfo }>('/prefixes', {
    method: 'POST',
    auth: true,
    body: input,
  });
  return response.data;
}

export async function updatePrefix(
  id: string,
  input: { name?: string; color?: string; priority?: number },
): Promise<AdminPrefixInfo> {
  const response = await request<{ data: AdminPrefixInfo }>(
    `/prefixes/${encodeURIComponent(id)}`,
    { method: 'PUT', auth: true, body: input },
  );
  return response.data;
}

export async function deletePrefix(id: string): Promise<void> {
  await request<{ data: AdminPrefixInfo }>(`/prefixes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ── Присутствие ──────────────────────────────────────────────

export async function fetchOnlineAdmins(): Promise<OnlineAdmin[]> {
  const response = await request<{ data: OnlineAdmin[] }>('/presence/admins');
  return response.data;
}

// ── Обращения ────────────────────────────────────────────────

export async function createReport(input: ReportInput): Promise<SupportTicket> {
  const response = await request<{ data: SupportTicket }>('/support/reports', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

export interface TicketListParams {
  status?: TicketStatus | 'all';
  kind?: TicketKind | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTickets(
  params: TicketListParams = {},
): Promise<{ data: SupportTicket[]; meta: { total: number; count: number; limit: number; offset: number } }> {
  const query = new URLSearchParams();

  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.kind && params.kind !== 'all') query.set('kind', params.kind);
  if (params.search) query.set('search', params.search);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request(`/support/tickets${suffix}`, { auth: true });
}

export async function fetchTicketStats(): Promise<TicketCounts> {
  const response = await request<{ data: TicketCounts }>('/support/tickets/stats', { auth: true });
  return response.data;
}

export async function updateTicket(
  id: string,
  input: { status?: TicketStatus; admin_reply?: string },
): Promise<SupportTicket> {
  const response = await request<{ data: SupportTicket }>(
    `/support/tickets/${encodeURIComponent(id)}`,
    { method: 'PUT', auth: true, body: input },
  );
  return response.data;
}

// ── Импорт ───────────────────────────────────────────────────

/**
 * Массовый импорт прайса: JSON + icons.png одним multipart-запросом.
 * Content-Type не задаём — браузер сам подставит boundary.
 */
interface ImportResponse {
  data?: ImportSummary;
  error?: { message?: string };
}

/**
 * Загружает файлы импорта через XHR, чтобы показывать прогресс отправки.
 */
export async function importPrices(
  prices: File,
  sprite: File,
  onProgress?: (percent: number) => void,
): Promise<ImportSummary> {
  const token = getStoredToken();

  if (!token) {
    throw new ApiError('Для доступа нужна авторизация', 401);
  }

  const body = new FormData();
  body.append('prices', prices);
  body.append('sprite', sprite);

  return new Promise<ImportSummary>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/import/prices`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => reject(new ApiError('Не удалось связаться с сервером импорта', 0));

    xhr.onload = () => {
      let payload: ImportResponse | null = null;

      try {
        payload = JSON.parse(xhr.responseText) as ImportResponse;
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.data) {
        resolve(payload.data);
        return;
      }

      if (xhr.status === 401) {
        clearStoredToken();
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }

      reject(
        new ApiError(
          payload?.error?.message ?? `Импорт не удался (${xhr.status})`,
          xhr.status,
        ),
      );
    };

    xhr.send(body);
  });
}

export async function fetchImportJobs(): Promise<ImportJob[]> {
  const response = await request<{ data: ImportJob[] }>('/import/jobs', { auth: true });
  return response.data;
}

export interface AuditLogParams {
  group?: AuditGroup | 'all';
  period?: AuditPeriod;
  userId?: string | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLogs(
  params: AuditLogParams = {},
): Promise<{ data: AuditLogEntry[]; meta: AuditLogMeta }> {
  const query = new URLSearchParams();

  if (params.group && params.group !== 'all') query.set('group', params.group);
  if (params.period) query.set('period', params.period);
  if (params.userId && params.userId !== 'all') query.set('user_id', params.userId);
  if (params.search) query.set('search', params.search);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<{ data: AuditLogEntry[]; meta: AuditLogMeta }>(`/audit${suffix}`, { auth: true });
}

export async function calculateTrade(
  input: TradeCalculationInput,
): Promise<TradeCalculationResult> {
  const response = await request<{ data: TradeCalculationResult }>('/trade/calculate', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

// ── Новости ──────────────────────────────────────────────────

export async function fetchNews(
  params: { limit?: number; offset?: number } = {},
): Promise<{ data: NewsPost[]; meta: ApiMeta }> {
  const query = new URLSearchParams();

  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<{ data: NewsPost[]; meta: ApiMeta }>(`/news${suffix}`);
}

/** Админский список: вместе с черновиками. */
export async function fetchAllNews(
  params: { limit?: number; offset?: number } = {},
): Promise<{ data: NewsPost[]; meta: ApiMeta }> {
  const query = new URLSearchParams();

  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<{ data: NewsPost[]; meta: ApiMeta }>(`/news/all${suffix}`, { auth: true });
}

export async function fetchNewsPost(id: string): Promise<NewsPost> {
  const response = await request<{ data: NewsPost }>(`/news/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createNews(input: NewsInput): Promise<NewsPost> {
  const response = await request<{ data: NewsPost }>('/news', {
    method: 'POST',
    body: input,
    auth: true,
  });
  return response.data;
}

export async function updateNews(id: string, input: Partial<NewsInput>): Promise<NewsPost> {
  const response = await request<{ data: NewsPost }>(`/news/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    auth: true,
  });
  return response.data;
}

export async function deleteNews(id: string): Promise<NewsPost> {
  const response = await request<{ data: NewsPost }>(`/news/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
  return response.data;
}

// ── Статистика посещений ─────────────────────────────────────

/**
 * Отправляет просмотр страницы. Никогда не бросает исключение:
 * статистика не должна влиять на работу сайта.
 */
export async function trackVisit(path: string, referrer = ''): Promise<void> {
  try {
    await fetch(`${API_BASE}/stats/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ path: path.slice(0, 255), referrer: referrer.slice(0, 255) }),
      credentials: 'same-origin',
      keepalive: true,
    });
  } catch {
    // Молча: недоступная статистика не должна ломать страницу.
  }
}

export async function fetchVisitStats(period: VisitPeriod): Promise<VisitStats> {
  const response = await request<{ data: VisitStats }>(`/stats/visits?period=${period}`, {
    auth: true,
  });
  return response.data;
}

export async function fetchVisitors(
  params: { limit?: number; offset?: number } = {},
): Promise<{ data: VisitorEntry[]; meta: ApiMeta }> {
  const query = new URLSearchParams();

  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<{ data: VisitorEntry[]; meta: ApiMeta }>(`/stats/visitors${suffix}`, {
    auth: true,
  });
}
