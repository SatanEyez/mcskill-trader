import { useCallback, useEffect, useState } from 'react';
import { fetchTicketStats } from '../lib/api';
import type { TicketCounts } from '../types';

interface UseTicketStatsResult {
  counts: TicketCounts | null;
  reload: () => Promise<void>;
}

/** Счётчики обращений для бейджа в админ-навигации. */
export function useTicketStats(enabled = true): UseTicketStatsResult {
  const [counts, setCounts] = useState<TicketCounts | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;

    try {
      setCounts(await fetchTicketStats());
    } catch {
      // Бейдж не критичен: молча оставляем прошлое значение.
    }
  }, [enabled]);

  useEffect(() => {
    void reload();

    if (!enabled) return;
    const timer = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  return { counts, reload };
}
