import { useCallback, useEffect, useState } from 'react';
import { fetchVisitStats } from '../lib/api';
import type { VisitPeriod, VisitStats } from '../types';

interface UseVisitStatsResult {
  stats: VisitStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Сводка посещений за выбранный период. */
export function useVisitStats(period: VisitPeriod): UseVisitStatsResult {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      setStats(await fetchVisitStats(period));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { stats, loading, error, reload };
}
