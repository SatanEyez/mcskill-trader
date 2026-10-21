import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Настройки подключения к MySQL живут в одном файле в корне репозитория
 * (`mysql-connection.env`) — его же читают phpMyAdmin и mysql-connect.cmd.
 * dotenv не перезаписывает уже заданные переменные, поэтому файл загружаем
 * первым: его значения важнее, чем `server/.env`.
 */
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

dotenv.config({ path: `${repoRoot}mysql-connection.env` });
dotenv.config({ path: `${repoRoot}server/.env` });
// На случай запуска из каталога server (npm run dev --workspace server).
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  ADMIN_LOGIN: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'Логин: латиница, цифры, точка, дефис, подчёркивание')
    .default('admin'),
  ADMIN_PASSWORD: z.string().min(4).default('change-me-strong-password'),
  JWT_SECRET: z.string().min(16).default('local-dev-secret-please-change-in-production-2026'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('mcskill'),
  MYSQL_PASSWORD: z.string().default('mcskill'),
  MYSQL_DATABASE: z.string().default('mcskill_trader'),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  /** Облачные MySQL (Aiven, TiDB, PlanetScale, Railway) пускают только по TLS. */
  MYSQL_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Путь к CA-сертификату провайдера, если он не входит в системные. */
  MYSQL_SSL_CA: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  SEED_ON_START: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Некорректные переменные окружения:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

if (isProduction) {
  if (env.ADMIN_PASSWORD === 'change-me-strong-password') {
    console.warn('⚠️  ADMIN_PASSWORD оставлен по умолчанию. Смените его перед публикацией!');
  }
  if (env.JWT_SECRET.startsWith('local-dev-secret')) {
    console.warn('⚠️  JWT_SECRET оставлен по умолчанию. Сгенерируйте случайный секрет!');
  }
}
