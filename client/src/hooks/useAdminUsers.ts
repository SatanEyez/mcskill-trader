import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUsers } from '../lib/api';
import type { AdminStatus, AdminUser, AdminUserCounts } from '../types';

const EMPTY_COUNTS: AdminUserCounts = { total: 0, pending: 0, approved: 0, rejected: 0 };

/** Событие «список администраторов изменился» — чтобы обновить счётчик заявок в табах. */
export const USERS_CHANGED_EVENT = 'mcskill:users-changed';

export function notifyUsersChanged(): void {
  window.dispatchEvent(new Event(USERS_CHANGED_EVENT));
}

interface UseAdminUsersResult {
  users: AdminUser[];
  counts: AdminUserCounts;
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

export function useAdminUsers(status: AdminStatus | 'all' = 'all'): UseAdminUsersResult {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState<AdminUserCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      const currentRequest = ++requestId.current;

      if (!options?.silent) setLoading(true);
      setError(null);

      try {
        const response = await fetchUsers(status);
        if (currentRequest !== requestId.current) return;
        setUsers(response.data);
        setCounts(response.meta);
      } catch (requestError) {
        if (currentRequest !== requestId.current) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось загрузить администраторов',
        );
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { users, counts, loading, error, reload };
}

/** Количество заявок, ожидающих одобрения — для бейджа во вкладке. */
export function usePendingUsersCount(enabled = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let active = true;

    const load = () => {
      fetchUsers('pending')
        .then((response) => {
          if (active) setCount(response.meta.pending);
        })
        .catch(() => {
          // Молча: бейдж не критичен для работы панели.
        });
    };

    load();
    window.addEventListener(USERS_CHANGED_EVENT, load);

    return () => {
      active = false;
      window.removeEventListener(USERS_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return count;
}
