import { useEffect } from 'react';
import { fetchTicketStats } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { TicketCounts } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseTicketStatsResult {
  counts: TicketCounts | null;
  reload: () => Promise<void>;
}

/** Счётчики обращений для бейджа в админ-навигации. */
export function useTicketStats(enabled = true): UseTicketStatsResult {
  const { data, reload } = useCachedFetch(QK.ticketStats, fetchTicketStats, {
    enabled,
    ttl: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      void reload({ silent: true }).catch(() => {
        // Бейдж не критичен: молча оставляем прошлое значение.
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  return {
    counts: data ?? null,
    reload: async () => {
      await reload({ silent: true });
    },
  };
}
