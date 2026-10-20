import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResources } from '../lib/api';
import type { Resource } from '../types';

interface UseResourcesResult {
  resources: Resource[];
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Загружает весь список ресурсов. Фильтрация на главной выполняется
 * на клиенте — это даёт мгновенный отклик без запросов на каждый символ.
 */
export function useResources(): UseResourcesResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const currentRequest = ++requestId.current;

    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const response = await fetchResources({ sort: 'name_asc' });
      if (currentRequest !== requestId.current) return;
      setResources(response.data);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Не удалось загрузить ресурсы',
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { resources, loading, error, reload };
}
