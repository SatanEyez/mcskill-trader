import { fetchResourceStats } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { ResourceStats } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseResourceStatsResult {
  stats: ResourceStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Сводка каталога: всего ресурсов, минимальная/средняя цена, категории. */
export function useResourceStats(): UseResourceStatsResult {
  const { data, loading, error, reload } = useCachedFetch(
    QK.resourceStats,
    fetchResourceStats,
    { ttl: 5 * 60_000 },
  );

  return { stats: data ?? null, loading, error, reload };
}
