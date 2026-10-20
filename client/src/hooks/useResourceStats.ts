import { useCallback, useEffect, useState } from 'react';
import { fetchResourceStats } from '../lib/api';
import type { ResourceStats } from '../types';

interface UseResourceStatsResult {
  stats: ResourceStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Сводка каталога: всего ресурсов, минимальная/средняя цена, категории. */
export function useResourceStats(): UseResourceStatsResult {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setStats(await fetchResourceStats());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить статистику каталога',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { stats, loading, error, reload };
}
