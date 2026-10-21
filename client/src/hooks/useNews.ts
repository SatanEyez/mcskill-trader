import { useCallback, useEffect, useState } from 'react';
import { fetchNews } from '../lib/api';
import type { NewsPost } from '../types';

interface UseNewsResult {
  posts: NewsPost[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Публичная лента новостей (только опубликованные). */
export function useNews(limit: number, offset = 0): UseNewsResult {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetchNews({ limit, offset });
      setPosts(response.data);
      setTotal(response.meta.total);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить новости');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { posts, total, loading, error, reload };
}
