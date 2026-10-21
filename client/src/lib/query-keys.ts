/**
 * Ключи кэша запросов.
 *
 * Один список на хуки и на предзагрузку: если ключ собран в двух местах
 * по-разному, предзагрузка промахивается и тратит запрос впустую.
 */

export const QK = {
  categories: 'categories',
  catalog: 'catalog',
  resourceStats: 'resource-stats',
  resources: (sort: string) => `resources:${sort}`,
  resourceFeed: (params: {
    search: string;
    categoryId: string;
    sort: string;
    page: number;
    limit: number;
  }) =>
    `resource-feed:${params.search}|${params.categoryId}|${params.sort}|${params.page}|${params.limit}`,
  news: (limit: number, offset: number) => `news:${limit}:${offset}`,
  allNews: (limit: number, offset: number) => `all-news:${limit}:${offset}`,
  users: (status: string) => `users:${status}`,
  staff: 'staff',
  ticketStats: 'ticket-stats',
  tickets: (params: {
    status: string;
    kind: string;
    search: string;
    limit: number;
    offset: number;
  }) =>
    `tickets:${params.status}|${params.kind}|${params.search}|${params.limit}|${params.offset}`,
  visitStats: (period: string) => `visit-stats:${period}`,
  visitors: (limit: number) => `visitors:${limit}`,
  auditLogs: (params: {
    group: string;
    period: string;
    userId: string;
    search: string;
    limit: number;
  }) =>
    `audit:${params.group}|${params.period}|${params.userId}|${params.search}|${params.limit}`,
} as const;
