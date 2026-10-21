import { fetchVisitStats } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { VisitPeriod, VisitStats } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseVisitStatsResult {
  stats: VisitStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Сводка посещений за выбранный период. */
export function useVisitStats(period: VisitPeriod): UseVisitStatsResult {
  const { data, loading, error, reload } = useCachedFetch(
    QK.visitStats(period),
    () => fetchVisitStats(period),
    { ttl: 60_000 },
  );

  return { stats: data ?? null, loading, error, reload };
}
