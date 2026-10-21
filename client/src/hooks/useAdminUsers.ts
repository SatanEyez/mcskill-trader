import { useEffect, useState } from 'react';
import { fetchUsers } from '../lib/api';
import { QK } from '../lib/query-keys';
import { readCache, cacheAge, writeCache } from '../lib/query-cache';
import type { AdminStatus, AdminUser, AdminUserCounts } from '../types';
import { useCachedFetch } from './useCachedFetch';

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
  const { data, loading, error, reload } = useCachedFetch(QK.users(status), () =>
    fetchUsers(status),
  );

  return {
    users: data?.data ?? [],
    counts: data?.meta ?? EMPTY_COUNTS,
    loading,
    error,
    reload,
  };
}

/** Количество заявок, ожидающих одобрения — для бейджа во вкладке. */
export function usePendingUsersCount(enabled = true): number {
  // Стартуем с прошлого значения из кэша: бейдж не должен «прыгать» с нуля.
  const [count, setCount] = useState(
    () => readCache<{ data: AdminUser[]; meta: AdminUserCounts }>(QK.users('pending'))?.meta.pending ?? 0,
  );

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let active = true;

    const load = () => {
      fetchUsers('pending')
        .then((response) => {
          writeCache(QK.users('pending'), response);
          if (active) setCount(response.meta.pending);
        })
        .catch(() => {
          // Молча: бейдж не критичен для работы панели.
        });
    };

    // При быстрых переходах между вкладками не дёргаем сеть повторно:
    // счётчик заявок меняется не чаще, чем раз в несколько секунд.
    const age = cacheAge(QK.users('pending'));
    if (age === null || age > 20_000) load();

    window.addEventListener(USERS_CHANGED_EVENT, load);

    return () => {
      active = false;
      window.removeEventListener(USERS_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return count;
}
