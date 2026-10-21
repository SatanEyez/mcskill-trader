import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { closeDb, getDb } from './index.js';
import { runMigrations } from './migrate.js';
import { cropPng, decodePng } from '../modules/import/png.js';
import { UPLOADS_DIR } from '../modules/uploads/upload.storage.js';
import { logger } from '../utils/logger.js';

const ICON_SIZE = 32;
const BATCH_SIZE = 200;

/**
 * Переносит иконки прайса из спрайта в таблицу price_icons — без импорта цен.
 *
 * Нужно, чтобы иконки пережили деплой, даже если файлы на диске пропадут:
 * импорт наполняет таблицу сам, но повторный прогон ради иконок — лишний час.
 */
async function main(): Promise<void> {
  await runMigrations();

  const spritePath = join(UPLOADS_DIR, 'prices', 'icons.png');
  const sprite = decodePng(await readFile(spritePath));

  if (sprite.width % ICON_SIZE !== 0 || sprite.height % ICON_SIZE !== 0) {
    throw new Error(
      `Спрайт должен делиться на ячейки ${ICON_SIZE}×${ICON_SIZE} (сейчас ${sprite.width}×${sprite.height})`,
    );
  }

  const columns = sprite.width / ICON_SIZE;
  const cells = columns * (sprite.height / ICON_SIZE);
  const db = await getDb();

  let batch: Array<[string, Buffer]> = [];
  let total = 0;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;

    await db.query(
      `INSERT INTO price_icons (name, data) VALUES ?
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [batch],
    );

    total += batch.length;
    batch = [];
  };

  for (let index = 0; index < cells; index += 1) {
    const icon = cropPng(
      sprite,
      (index % columns) * ICON_SIZE,
      Math.floor(index / columns) * ICON_SIZE,
      ICON_SIZE,
      ICON_SIZE,
    );

    batch.push([`${String(index + 1).padStart(5, '0')}.png`, icon]);

    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  logger.ready(`Готово: иконок в базе — ${total}`);
}

main()
  .catch((error) => {
    logger.error('Не удалось перенести иконки в базу:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
