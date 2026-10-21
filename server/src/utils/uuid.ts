import { HttpError } from './http-error.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Проверяет, что строка — UUID.
 *
 * В PostgreSQL неверный UUID отсекал сам тип колонки (SQLSTATE 22P02 → 400).
 * В MySQL идентификатор хранится как CHAR(36), поэтому формат проверяем здесь,
 * чтобы клиент получал тот же ответ 400, а не 404.
 */
export function requireUuid(value: string, label = 'идентификатор'): string {
  if (!UUID_PATTERN.test(value)) {
    throw new HttpError(400, `Некорректный ${label}`);
  }

  return value;
}
