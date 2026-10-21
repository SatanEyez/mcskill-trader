/**
 * Кэш ответов API на клиенте.
 *
 * Зачем: каждый хук раньше начинал с пустого состояния и спиннера, поэтому
 * любой переход между вкладками заново тянул те же данные. Теперь ответ
 * кладётся в память по ключу, и повторный заход рисует страницу сразу,
 * а сеть догружает свежее в фоне.
 *
 * Кэш живёт только в памяти вкладки: перезагрузка страницы его очищает,
 * а выход из аккаунта — тоже (см. AuthContext), чтобы чужое не показывалось.
 */

interface CacheEntry {
  data: unknown;
  at: number;
}

/** Сколько данные считаются свежими: дальше — тихое обновление в фоне. */
export const DEFAULT_TTL = 60_000;

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function readCache<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function cacheAge(key: string): number | null {
  const entry = store.get(key);
  return entry ? Date.now() - entry.at : null;
}

export function isFresh(key: string, ttl = DEFAULT_TTL): boolean {
  const age = cacheAge(key);
  return age !== null && age < ttl;
}

/** Сколько данных держим одновременно. Поиск по каталогу плодит ключи. */
const MAX_ENTRIES = 150;

export function writeCache<T>(key: string, data: T): T {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    // Map хранит порядок вставки — первым уходит самый старый ключ.
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }

  store.set(key, { data, at: Date.now() });
  return data;
}

/** Сбрасывает ключи по префиксу: `dropCache('users')` чистит `users:all` и т.п. */
export function dropCache(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache(): void {
  store.clear();
  inflight.clear();
}

/**
 * Одинаковые запросы схлопываются в один: два хука с тем же ключом
 * (например, шапка и страница) не делают два сетевых вызова.
 */
export function loadOnce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((data) => writeCache(key, data))
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Фоновая загрузка «на будущее»: без спиннеров и без ошибок в консоли.
 * Если данные уже свежие или запрос уже летит — ничего не делает.
 */
export function prefetch<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): void {
  if (isFresh(key, ttl) || inflight.has(key)) return;

  void loadOnce(key, fetcher).catch(() => {
    // Предзагрузка не критична: страница сама повторит запрос при открытии.
  });
}
