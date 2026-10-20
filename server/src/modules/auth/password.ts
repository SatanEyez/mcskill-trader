import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCHEME = 'scrypt';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Хеш для проверки пароля при несуществующем логине: выравнивает время ответа. */
const DUMMY_HASH = `${SCHEME}:${'0'.repeat(SALT_LENGTH * 2)}:${'0'.repeat(KEY_LENGTH * 2)}`;

/** Возвращает строку вида `scrypt:<salt-hex>:<hash-hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);

  return `${SCHEME}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = storedHash.split(':');

  if (scheme !== SCHEME || !saltHex || !hashHex || hashHex.length % 2 !== 0) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scrypt(password, salt, expected.length);

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Проверка для логина, которого нет: результат всегда false, но время сопоставимо. */
export async function verifyDummyPassword(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}
