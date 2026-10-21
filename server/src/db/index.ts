import { readFileSync } from 'node:fs';
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
} from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Database {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  /** Выполняет один DDL/DML-оператор без параметров. */
  exec(sql: string): Promise<void>;
  /** Выполняет колбэк в транзакции: при ошибке изменения откатываются. */
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

type Executor = Pool | PoolConnection;

async function runQuery<T>(
  executor: Executor,
  sql: string,
  params: unknown[],
): Promise<QueryResult<T>> {
  const [result] = await executor.query(sql, params);

  if (Array.isArray(result)) {
    return { rows: result as T[], rowCount: result.length };
  }

  const header = result as ResultSetHeader;
  return { rows: [], rowCount: header.affectedRows ?? 0 };
}

class MySqlDatabase implements Database {
  /** Соединение внутри транзакции; у пула его нет. */
  constructor(
    private readonly executor: Executor,
    private readonly pool: Pool | null = null,
  ) {}

  query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return runQuery<T>(this.executor, sql, params);
  }

  async exec(sql: string): Promise<void> {
    await this.executor.query(sql);
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    if (!this.pool) {
      // Мы уже внутри транзакции — вложенности MySQL не поддерживает.
      return fn(this);
    }

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await fn(new MySqlDatabase(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}

let databasePromise: Promise<Database> | null = null;

async function createDatabase(): Promise<Database> {
  // Облачные MySQL принимают подключения только по TLS.
  const ssl = env.MYSQL_SSL
    ? {
        ...(env.MYSQL_SSL_CA ? { ca: readFileSync(env.MYSQL_SSL_CA, 'utf8') } : {}),
        rejectUnauthorized: true,
      }
    : undefined;

  const pool: Pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    // Все DATETIME в базе храним в UTC, драйвер читает их тоже как UTC.
    timezone: 'Z',
    ...(ssl ? { ssl } : {}),
    waitForConnections: true,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    throw error;
  }

  logger.info(
    `MySQL: ${env.MYSQL_USER}@${env.MYSQL_HOST}:${env.MYSQL_PORT}/${env.MYSQL_DATABASE}`,
  );

  return new MySqlDatabase(pool, pool);
}

export function getDb(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = createDatabase();

    // Неудачное подключение не должно навсегда «залипнуть» в кеше промиса.
    databasePromise.catch(() => {
      databasePromise = null;
    });
  }

  return databasePromise;
}

export async function closeDb(): Promise<void> {
  if (!databasePromise) return;

  const database = await databasePromise;
  await database.close();
  databasePromise = null;

  logger.info('Соединение с базой данных закрыто');
}
