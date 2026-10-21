import { randomUUID } from 'node:crypto';
import { getDb } from './index.js';
import { seedResources } from './seed-data.js';
import { logger } from '../utils/logger.js';

export interface SeedResult {
  inserted: number;
  skipped: boolean;
}

/**
 * Заполняет базу демо-ресурсами и категориями.
 * При force=true таблицы ресурсов и категорий очищаются и данные заливаются заново.
 */
export async function seedDatabase(force = false): Promise<SeedResult> {
  const db = await getDb();

  const countResult = await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM resources');
  const existing = Number(countResult.rows[0]?.count ?? 0);

  if (existing > 0 && !force) {
    return { inserted: 0, skipped: true };
  }

  if (force) {
    // Порядок важен из-за внешнего ключа resources → categories.
    await db.query('DELETE FROM resources');
    await db.query('DELETE FROM categories');
  }

  const categoryIds = new Map<string, string>();
  const categoryNames = Array.from(new Set(seedResources.map((resource) => resource.category)));

  for (const name of categoryNames) {
    const id = randomUUID();
    const inserted = await db.query('INSERT IGNORE INTO categories (id, name) VALUES (?, ?)', [
      id,
      name,
    ]);

    let categoryId: string | null = inserted.rowCount > 0 ? id : null;

    if (!categoryId) {
      const found = await db.query<{ id: string }>('SELECT id FROM categories WHERE name = ?', [
        name,
      ]);
      categoryId = found.rows[0]?.id ?? null;
    }

    if (!categoryId) {
      throw new Error(`Не удалось создать категорию «${name}»`);
    }

    categoryIds.set(name.toLowerCase(), categoryId);
  }

  for (const resource of seedResources) {
    await db.query(
      `INSERT IGNORE INTO resources (id, name, min_price, image_url, category_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        resource.name,
        resource.min_price,
        resource.image_url,
        categoryIds.get(resource.category.toLowerCase()) ?? null,
      ],
    );
  }

  logger.info(
    `База заполнена демо-данными: ${seedResources.length} ресурсов, ${categoryNames.length} категорий`,
  );
  return { inserted: seedResources.length, skipped: false };
}
