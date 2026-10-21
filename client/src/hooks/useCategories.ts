import { fetchCategories } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { Category } from '../types';
import { useCachedFetch } from './useCachedFetch';

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/** Загружает полный список категорий вместе с количеством ресурсов. */
export function useCategories(): UseCategoriesResult {
  const { data, loading, error, reload } = useCachedFetch(QK.categories, fetchCategories);

  return { categories: data ?? [], loading, error, reload };
}
