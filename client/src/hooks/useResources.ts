import { fetchResources } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { Resource } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseResourcesResult {
  resources: Resource[];
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Загружает весь список ресурсов. Фильтрация на главной выполняется
 * на клиенте — это даёт мгновенный отклик без запросов на каждый символ.
 */
export function useResources(): UseResourcesResult {
  const { data, loading, error, reload } = useCachedFetch(QK.resources('name_asc'), () =>
    fetchResources({ sort: 'name_asc' }),
  );

  return { resources: data?.data ?? [], loading, error, reload };
}
