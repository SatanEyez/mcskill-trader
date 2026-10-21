/** Экранирует спецсимволы LIKE, чтобы `%`, `_` и `!` искались буквально. */
export function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, '!$&');
}

/**
 * Нормализует строку для «мягкого» поиска: убирает дефисы, пробелы и
 * приводит к нижнему регистру. «мета-материя» и «мета материя» → «метаматерия».
 */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[-\s]/g, '');
}
