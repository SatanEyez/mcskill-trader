import { fetchResources } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { Resource, ResourceSort } from '../types';
import { useCachedFetch } from './useCachedFetch';

export interface ResourceFeedParams {
  search: string;
  categoryId: string;
  sort: ResourceSort;
  page: number;
  limit: number;
}

interface ResourceFeedResult {
  resources: Resource[];
  total: number;
  pages: number;
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Постраничная лента каталога с серверным поиском и фильтром категории.
 * 9 000+ ресурсов нельзя рендерить одним списком, поэтому страница
 * запрашивается отдельно, а поиск выполняется на сервере.
 *
 * Каждая страница и набор фильтров кэшируются отдельно: возврат на
 * предыдущую страницу или сброс поиска рисуется мгновенно.
 */
export function useResourceFeed(params: ResourceFeedParams): ResourceFeedResult {
  const { search, categoryId, sort, page, limit } = params;

  const { data, loading, error, reload } = useCachedFetch(
    QK.resourceFeed({ search, categoryId, sort, page, limit }),
    () =>
      fetchResources({
        search: search || undefined,
        category_id: categoryId || undefined,
        sort,
        page,
        limit,
      }),
  );

  return {
    resources: data?.data ?? [],
    total: data?.meta.total ?? 0,
    pages: Math.max(1, data?.meta.pages ?? 1),
    loading,
    error,
    reload,
  };
}
