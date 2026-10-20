import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './index.js';
import { logger } from '../utils/logger.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

/**
 * Простой мигратор: применяет *.sql-файлы по алфавиту ровно один раз.
 * Сами миграции написаны идемпотентно, поэтому безопасны при перезапуске.
 */
export async function runMigrations(): Promise<void> {
  const db = await getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await db.exec(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);

    logger.info(`Миграция применена: ${basename(file)}`);
  }
}
