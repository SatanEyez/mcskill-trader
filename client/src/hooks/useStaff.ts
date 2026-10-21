import { fetchStaffMembers } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { AdminStaffMeta, AdminUser } from '../types';
import { useCachedFetch } from './useCachedFetch';

const EMPTY_META: AdminStaffMeta = { total: 0, online: 0, total_online_seconds: 0 };

interface UseStaffResult {
  staff: AdminUser[];
  meta: AdminStaffMeta;
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/** Полный список администрации с присутствием — для вкладки «Администрация». */
export function useStaff(enabled = true): UseStaffResult {
  const { data, loading, error, reload } = useCachedFetch(QK.staff, fetchStaffMembers, {
    enabled,
    // Присутствие «в сети» живёт секундами, поэтому кэш короткий.
    ttl: 20_000,
  });

  return {
    staff: data?.data ?? [],
    meta: data?.meta ?? EMPTY_META,
    loading,
    error,
    reload,
  };
}
