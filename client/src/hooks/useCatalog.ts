import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCatalog } from '../lib/api';
import type { Resource } from '../types';

interface UseCatalogResult {
  resources: Resource[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Полный каталог для трейд-калькулятора.
 * В отличие от главной, калькулятору нужны все предметы сразу: строки обмена
 * хранятся в localStorage и могут ссылаться на любую страницу каталога.
 */
export function useCatalog(): UseCatalogResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchCatalog();
      if (currentRequest !== requestId.current) return;
      setResources(data);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить каталог',
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
