import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStaffMembers } from '../lib/api';
import type { AdminStaffMeta, AdminUser } from '../types';

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
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<AdminStaffMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const currentRequest = ++requestId.current;

    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const response = await fetchStaffMembers();
      if (currentRequest !== requestId.current) return;
      setStaff(response.data);
      setMeta(response.meta);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить список администрации',
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  return { staff, meta, loading, error, reload };
}
