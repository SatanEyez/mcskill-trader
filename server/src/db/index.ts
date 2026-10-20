import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { acquireDbLock, type DbLock } from './lock.js';

const { Pool } = pg;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Database {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

class PGliteDatabase implements Database {
  constructor(private readonly client: PGlite) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const result = await this.client.query<T>(sql, params as never[]);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.exec(sql);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

class PostgresDatabase implements Database {
  constructor(private readonly pool: pg.Pool) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params as never[]);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function createDatabase(): Promise<Database> {
  if (env.DATABASE_URL) {
    logger.info('Подключение к PostgreSQL по DATABASE_URL');
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    await pool.query('SELECT 1');
    return new PostgresDatabase(pool);
  }

  const dataDir = resolve(env.PGLITE_DATA_DIR);
  await mkdir(dataDir, { recursive: true });

  // Один процесс на каталог данных: иначе PGlite повреждает WAL.
  dbLock = await acquireDbLock(`${dataDir}.lock`);

  try {
    logger.info(`Встроенный PostgreSQL (PGlite): ${dataDir}`);

    const client = new PGlite(dataDir);
    await client.waitReady;
    return new PGliteDatabase(client);
  } catch (error) {
    await dbLock.release();
    dbLock = null;

    if (error instanceof Error && /Aborted/i.test(error.message)) {
      throw new Error(
        'PGlite не смогла открыть каталог данных: он повреждён (жёсткое завершение процесса ' +
          'или два API на одной базе). Остановите все процессы API, переименуйте ' +
          `«${dataDir}» в архивный каталог и запустите сервер заново — миграции и демо-данные ` +
          'применятся автоматически.',
      );
    }

    throw error;
  }
}

let databasePromise: Promise<Database> | null = null;
let dbLock: DbLock | null = null;

export function getDb(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = createDatabase();
  }
  return databasePromise;
}

export async function closeDb(): Promise<void> {
  if (!databasePromise) return;

  const database = await databasePromise;
  await database.close();
  databasePromise = null;

  if (dbLock) {
    await dbLock.release();
    dbLock = null;
  }

  logger.info('Соединение с базой данных закрыто');
}
