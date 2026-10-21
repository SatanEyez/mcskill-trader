import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TTL, isFresh, loadOnce, readCache } from '../lib/query-cache';

export interface CachedFetchOptions {
  /** Хук выключен — ничего не грузим (например, нет прав на раздел). */
  enabled?: boolean;
  /** Сколько данные считаются свежими. */
  ttl?: number;
}

export interface CachedFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Загрузка данных с кэшем по ключу.
 *
 * Логика простая: если в кэше что-то есть — отдаём сразу и без спиннера,
 * а сеть догружает свежее в фоне. Если пусто — обычный первый запрос
 * со спиннером. `reload()` всегда идёт в сеть (нужно после сохранений).
 */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedFetchOptions = {},
): CachedFetchResult<T> {
  const { enabled = true, ttl = DEFAULT_TTL } = options;

  const cached = readCache<T>(key);
  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(enabled && cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  // Колбэк запроса храним в ref: иначе inline-стрелка в аргументах
  // меняла бы identity на каждом рендере и запускала бесконечный цикл.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(
    async (reloadOptions?: { silent?: boolean }) => {
      if (!enabled) return;

      const currentRequest = ++requestId.current;
      // Явный вызов (кнопка «Обновить», повтор после ошибки) показывает спиннер;
      // фоновое обновление при возврате на вкладку — нет.
      const silent = reloadOptions?.silent ?? false;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const next = await loadOnce(key, () => fetcherRef.current());
        if (currentRequest !== requestId.current) return;
        setData(next);
      } catch (cause) {
        if (currentRequest !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить данные');
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [key, enabled],
  );

  // Сменился ключ (фильтр, страница, период) — сразу подставляем кэш.
  // Если кэша нет, старые данные не стираем: список не должен пустеть
  // на каждый символ в поиске, спиннер покажет сама страница.
  useEffect(() => {
    const hit = readCache<T>(key);

    if (hit !== undefined) {
      setData(hit);
      setLoading(false);
    } else {
      setLoading(enabled);
    }

    setError(null);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (isFresh(key, ttl)) return;

    // Данные из кэша уже на экране — обновляем их тихо, без спиннера.
    void reload({ silent: readCache<T>(key) !== undefined });
  }, [key, enabled, ttl, reload]);

  return { data, loading, error, reload };
}
