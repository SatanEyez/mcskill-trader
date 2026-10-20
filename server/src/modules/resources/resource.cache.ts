import type { ListResourcesQuery, ResourceDto } from './resource.types.js';

export interface ResourceListResult {
  data: ResourceDto[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface CacheEntry {
  expiresAt: number;
  result: ResourceListResult;
}

/** Каталог читают все посетители — кеш на несколько секунд снимает пиковую нагрузку. */
const TTL_MS = 15_000;

/** Больше 64 вариантов запроса не держим: столько разных фильтров и страниц не нужно. */
const MAX_ENTRIES = 64;

const cache = new Map<string, CacheEntry>();
let catalogCache: { expiresAt: number; data: ResourceDto[] } | null = null;

function keyOf(query: ListResourcesQuery): string {
  return [query.search, query.category_id ?? '', query.sort, query.page, query.limit].join(
    '\u0000',
  );
}

export function readResourceListCache(query: ListResourcesQuery): ResourceListResult | null {
  const key = keyOf(query);
  const entry = cache.get(key);

  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.result;
}

export function writeResourceListCache(
  query: ListResourcesQuery,
  result: ResourceListResult,
): void {
  if (cache.size >= MAX_ENTRIES) cache.clear();

  cache.set(keyOf(query), { expiresAt: Date.now() + TTL_MS, result });
}

export function readCatalogCache(): ResourceDto[] | null {
  if (!catalogCache) return null;

  if (catalogCache.expiresAt <= Date.now()) {
    catalogCache = null;
    return null;
  }

  return catalogCache.data;
}

export function writeCatalogCache(data: ResourceDto[]): void {
  catalogCache = { expiresAt: Date.now() + TTL_MS, data };
}

/** Сбрасываем кеш после любых изменений ресурсов и категорий. */
export function invalidateResourceListCache(): void {
  cache.clear();
  catalogCache = null;
}
