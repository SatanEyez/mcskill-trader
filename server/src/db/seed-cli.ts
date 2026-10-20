import { closeDb } from './index.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';
import { logger } from '../utils/logger.js';

const force = process.argv.includes('--force');

async function main(): Promise<void> {
  await runMigrations();
  const result = await seedDatabase(force);

  if (result.skipped) {
    logger.warn('В базе уже есть ресурсы. Для перезаписи: npm run db:seed:force');
  } else {
    logger.ready(`Готово: добавлено ${result.inserted} ресурсов`);
  }
}

main()
  .catch((error) => {
    logger.error('Не удалось заполнить базу:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
