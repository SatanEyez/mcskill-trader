import { fetchCatalog } from '../lib/api';
import { QK } from '../lib/query-keys';
import type { Resource } from '../types';
import { useCachedFetch } from './useCachedFetch';

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
  const { data, loading, error, reload } = useCachedFetch(QK.catalog, fetchCatalog, {
    // Каталог меняется реже, чем каталог-лента: держим его дольше.
    ttl: 5 * 60_000,
  });

  return { resources: data ?? [], loading, error, reload };
}
