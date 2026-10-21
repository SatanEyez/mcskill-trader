import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './index.js';
import { logger } from '../utils/logger.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

/**
 * Разбивает файл миграции на отдельные операторы.
 *
 * MySQL не принимает несколько операторов в одном запросе, а включать
 * `multipleStatements` на пуле небезопасно. Кавычки и комментарии учитываются,
 * чтобы `;` внутри строки или комментария не разрезал оператор.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | '`' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    const next = sql[index + 1];

    if (quote) {
      current += char;

      if (char === '\\' && quote !== '`' && next !== undefined) {
        current += next;
        index += 1;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '-' && next === '-') {
      const lineEnd = sql.indexOf('\n', index);
      const end = lineEnd === -1 ? sql.length : lineEnd;
      // Комментарий сохраняем: по нему мигратор понимает директиву @tidb: skip.
      current += sql.slice(index, end);
      index = end - 1;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = sql.indexOf('*/', index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      statements.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  statements.push(current);

  return statements
    .map((statement) => statement.trim())
    .filter((statement) => hasSqlBody(statement));
}

/** Оператор без SQL-кода (только комментарии) выполнять нельзя — MySQL ответит синтаксической ошибкой. */
function hasSqlBody(statement: string): boolean {
  return statement
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !line.startsWith('--'));
}

/**
 * Простой мигратор: применяет *.sql-файлы по алфавиту ровно один раз.
 * Файлы написаны для MySQL 8+/9 и выполняются оператор за оператором.
 *
 * TiDB Cloud совместим с MySQL не полностью, поэтому оператор, перед которым
 * стоит комментарий `-- @tidb: skip`, на TiDB не выполняется.
 */
export async function runMigrations(): Promise<void> {
  const db = await getDb();

  const version = await db.query<{ version: string }>('SELECT VERSION() AS version');
  const isTiDB = /TiDB/i.test(version.rows[0]?.version ?? '');

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf8');

    for (const statement of splitStatements(sql)) {
      if (isTiDB && statement.includes('@tidb: skip')) {
        logger.warn(`TiDB: пропущен несовместимый оператор из ${basename(file)}`);
        continue;
      }

      await db.exec(statement);
    }

    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);

    logger.info(`Миграция применена: ${basename(file)}`);
  }
}
