import { fetchNews } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { NewsPost } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseNewsResult {
  posts: NewsPost[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Публичная лента новостей (только опубликованные). */
export function useNews(limit: number, offset = 0): UseNewsResult {
  const { data, loading, error, reload } = useCachedFetch(
    QK.news(limit, offset),
    () => fetchNews({ limit, offset }),
    { ttl: 2 * 60_000 },
  );

  return {
    posts: data?.data ?? [],
    total: data?.meta.total ?? 0,
    loading,
    error,
    reload,
  };
}
