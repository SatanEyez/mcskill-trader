import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCategories } from '../lib/api';
import type { Category } from '../types';

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/** Загружает полный список категорий вместе с количеством ресурсов. */
export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const currentRequest = ++requestId.current;

    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const data = await fetchCategories();
      if (currentRequest !== requestId.current) return;
      setCategories(data);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Не удалось загрузить категории',
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, loading, error, reload };
}
