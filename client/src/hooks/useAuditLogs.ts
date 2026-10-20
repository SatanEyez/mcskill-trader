import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuditLogs } from '../lib/api';
import type { AuditGroup, AuditLogEntry, AuditPeriod } from '../types';

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

export function useAuditLogs(filters: AuditFilters): UseAuditLogsResult {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const { group, period, userId, search } = filters;

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      const currentRequest = ++requestId.current;

      if (!options?.silent) setLoading(true);
      setError(null);

      try {
        const response = await fetchAuditLogs({
          group,
          period,
          userId,
          search,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (currentRequest !== requestId.current) return;
        setEntries(response.data);
        setTotal(response.meta.total);
      } catch (requestError) {
        if (currentRequest !== requestId.current) return;
        setError(
          requestError instanceof Error ? requestError.message : 'Не удалось загрузить журнал',
        );
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [group, period, userId, search],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;

    setLoadingMore(true);
    const currentRequest = requestId.current;

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
      setEntries((current) => [...current, ...response.data]);
      setTotal(response.meta.total);
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setError(
          requestError instanceof Error ? requestError.message : 'Не удалось загрузить журнал',
        );
      }
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
