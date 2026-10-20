/** Экранирует спецсимволы LIKE, чтобы `%`, `_` и `!` искались буквально. */
export function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, '!$&');
}
