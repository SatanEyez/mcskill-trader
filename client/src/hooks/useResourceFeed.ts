import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResources } from '../lib/api';
import type { Resource, ResourceSort } from '../types';

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
 */
export function useResourceFeed(params: ResourceFeedParams): ResourceFeedResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      const currentRequest = ++requestId.current;

      if (!options?.silent) setLoading(true);
      setError(null);

      try {
        const response = await fetchResources({
          search: params.search || undefined,
          category_id: params.categoryId || undefined,
          sort: params.sort,
          page: params.page,
          limit: params.limit,
        });

        if (currentRequest !== requestId.current) return;

        setResources(response.data);
        setTotal(response.meta.total);
        setPages(Math.max(1, response.meta.pages ?? 1));
      } catch (requestError) {
        if (currentRequest !== requestId.current) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось загрузить каталог',
        );
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [params.search, params.categoryId, params.sort, params.page, params.limit],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { resources, total, pages, loading, error, reload };
}
