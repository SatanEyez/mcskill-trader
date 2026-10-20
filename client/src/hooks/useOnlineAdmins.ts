import { useCallback, useEffect, useState } from 'react';
import { fetchOnlineAdmins } from '../lib/api';
import type { OnlineAdmin } from '../types';

const POLL_MS = 30_000;

interface UseOnlineAdminsResult {
  admins: OnlineAdmin[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Блок «В сети администраторы»: обновляем список раз в 30 секунд. */
export function useOnlineAdmins(): UseOnlineAdminsResult {
  const [admins, setAdmins] = useState<OnlineAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);

    try {
      setAdmins(await fetchOnlineAdmins());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось получить список администраторов',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), POLL_MS);

    return () => window.clearInterval(timer);
  }, [reload]);

  return { admins, loading, error, reload };
}
