import {
  fetchAllNews,
  fetchCatalog,
  fetchCategories,
  fetchNews,
  fetchResourceStats,
  fetchResources,
  fetchStaffMembers,
  fetchTicketStats,
  fetchTickets,
  fetchUsers,
  fetchVisitors,
  fetchVisitStats,
} from './api';
import { prefetch } from './query-cache';
import { QK } from './query-keys';

/**
 * Предзагрузка данных разделов.
 *
 * Срабатывает на наведение/фокус на вкладку и один раз после входа в админку:
 * к моменту клика данные обычно уже в кэше, и страница открывается без спиннера.
 * Промах ничего не ломает — страница просто загрузится как раньше.
 */

const ADMIN_FEED = { search: '', categoryId: '', sort: 'name_asc', page: 1, limit: 40 };
const PUBLIC_FEED = { search: '', categoryId: '', sort: 'name_asc', page: 1, limit: 36 };
const ADMIN_NEWS = { limit: 20, offset: 0 };
const PUBLIC_NEWS = { limit: 9, offset: 0 };

type Loader = () => void;

const ROUTE_LOADERS: Record<string, Loader[]> = {
  '/': [
    () => prefetch(QK.resourceStats, fetchResourceStats),
    () =>
      prefetch(QK.resourceFeed(PUBLIC_FEED), () =>
        fetchResources({
          sort: 'name_asc',
          page: PUBLIC_FEED.page,
          limit: PUBLIC_FEED.limit,
        }),
      ),
  ],
  '/trade': [() => prefetch(QK.catalog, fetchCatalog)],
  '/news': [
    () => prefetch(QK.news(PUBLIC_NEWS.limit, PUBLIC_NEWS.offset), () => fetchNews(PUBLIC_NEWS)),
  ],
  '/admin': [
    () => prefetch(QK.resourceStats, fetchResourceStats),
    () => prefetch(QK.categories, fetchCategories),
    () =>
      prefetch(QK.resourceFeed(ADMIN_FEED), () =>
        fetchResources({
          sort: 'name_asc',
          page: ADMIN_FEED.page,
          limit: ADMIN_FEED.limit,
        }),
      ),
  ],
  '/admin/categories': [() => prefetch(QK.categories, fetchCategories)],
  '/admin/news': [
    () => prefetch(QK.allNews(ADMIN_NEWS.limit, ADMIN_NEWS.offset), () => fetchAllNews(ADMIN_NEWS)),
  ],
  '/admin/users': [
    () => prefetch(QK.users('all'), () => fetchUsers('all')),
    () => prefetch(QK.staff, fetchStaffMembers),
  ],
  '/admin/logs': [() => prefetch(QK.users('all'), () => fetchUsers('all'))],
  '/admin/stats': [
    () => prefetch(QK.visitStats('7d'), () => fetchVisitStats('7d')),
    () => prefetch(QK.visitors(50), () => fetchVisitors({ limit: 50 })),
  ],
  '/admin/support': [
    () =>
      prefetch(QK.tickets({ status: 'all', kind: 'all', search: '', limit: 20, offset: 0 }), async () => {
        const [list, stats] = await Promise.all([
          fetchTickets({ status: 'all', kind: 'all', search: '', limit: 20, offset: 0 }),
          fetchTicketStats(),
        ]);

        return { list, stats };
      }),
  ],
  '/admin/panel': [
    () => prefetch(QK.ticketStats, fetchTicketStats),
    () => prefetch(QK.staff, fetchStaffMembers),
  ],
};

/** Разделы, которые греем заранее после входа — самые частые. */
const WARM_ROUTES = ['/admin', '/admin/categories', '/admin/users', '/admin/support'];

export function prefetchRoute(path: string): void {
  const loaders = ROUTE_LOADERS[path];
  if (!loaders) return;

  for (const load of loaders) load();
}

/**
 * Прогрев в простое: не мешает первой отрисовке и не спорит с текущим
 * экраном за канал. `requestIdleCallback` есть не везде — есть фолбэк.
 */
export function warmRoutes(routes: string[] = WARM_ROUTES): void {
  const run = () => {
    for (const route of routes) prefetchRoute(route);
  };

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;

  if (typeof idle === 'function') {
    idle(run);
    return;
  }

  window.setTimeout(run, 1200);
}
