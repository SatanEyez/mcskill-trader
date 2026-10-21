import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuditLogs } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { AuditGroup, AuditLogEntry, AuditPeriod } from '../types';
import { useCachedFetch } from './useCachedFetch';

const PAGE_SIZE = 50;

export interface AuditFilters {
  group: AuditGroup | 'all';
  period: AuditPeriod;
  userId: string | 'all';
  search: string;
}

interface UseAuditLogsResult {
  entries: AuditLogEntry[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  reload: (options?: { silent?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Журнал действий. Первая страница кэшируется по фильтрам — возврат на
 * вкладку с теми же фильтрами открывается сразу. Догрузка «ещё» идёт мимо
 * кэша и просто дописывается в конец списка.
 */
export function useAuditLogs(filters: AuditFilters): UseAuditLogsResult {
  const { group, period, userId, search } = filters;

  const { data, loading, error, reload } = useCachedFetch(
    QK.auditLogs({ group, period, userId, search, limit: PAGE_SIZE }),
    () => fetchAuditLogs({ group, period, userId, search, limit: PAGE_SIZE, offset: 0 }),
  );

  const [extra, setExtra] = useState<AuditLogEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);

  // Сменились фильтры — догруженные страницы больше не относятся к делу.
  useEffect(() => {
    setExtra([]);
  }, [group, period, userId, search]);

  const entries = data ? [...data.data, ...extra] : extra;
  const total = data?.meta.total ?? 0;

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;

    setLoadingMore(true);
    const currentRequest = ++requestId.current;

    try {
      const response = await fetchAuditLogs({
        group,
        period,
        userId,
        search,
        limit: PAGE_SIZE,
        offset: entries.length,
      });

      if (currentRequest !== requestId.current) return;
      setExtra((current) => [...current, ...response.data]);
    } catch {
      // Ошибку догрузки не показываем отдельно: основной список уже на экране.
    } finally {
      setLoadingMore(false);
    }
  }, [entries.length, group, loading, loadingMore, period, search, userId]);

  return {
    entries,
    total,
    loading,
    loadingMore,
    error,
    hasMore: entries.length < total,
    reload,
    loadMore,
  };
}
