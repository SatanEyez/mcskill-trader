import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import { invalidateResourceListCache } from '../resources/resource.cache.js';
import type { CategoryDto, CategoryInput, CategoryRow } from './category.types.js';

function toDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    resource_count: Number(row.resource_count ?? 0),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

const CATEGORY_SELECT = `
  SELECT c.id,
         c.name,
         c.created_at,
         c.updated_at,
         ((SELECT COUNT(*) FROM resources AS r WHERE r.category_id = c.id)
          + (SELECT COUNT(*) FROM resource_categories AS rc WHERE rc.category_id = c.id))
           AS resource_count
    FROM categories AS c
`;

async function findCategoryById(id: string): Promise<CategoryRow | null> {
  const db = await getDb();
  const result = await db.query<CategoryRow>(`${CATEGORY_SELECT} WHERE c.id = ?`, [id]);

  return result.rows[0] ?? null;
}

async function assertNameIsFree(name: string, exceptId?: string): Promise<void> {
  const db = await getDb();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE name = ?${exceptId ? ' AND id <> ?' : ''}`,
    exceptId ? [name, exceptId] : [name],
  );

  if (result.rows.length > 0) {
    throw new HttpError(409, 'Категория с таким названием уже существует');
  }
}

export async function listCategories(): Promise<CategoryDto[]> {
  const db = await getDb();
  const result = await db.query<CategoryRow>(`${CATEGORY_SELECT} ORDER BY c.name ASC`);

  return result.rows.map(toDto);
}

export async function createCategory(input: CategoryInput): Promise<CategoryDto> {
  await assertNameIsFree(input.name);

  const db = await getDb();
  const id = randomUUID();

  await db.query('INSERT INTO categories (id, name) VALUES (?, ?)', [id, input.name]);

  invalidateResourceListCache();

  const created = await findCategoryById(id);

  if (!created) {
    throw new HttpError(500, 'Не удалось создать категорию');
  }

  return toDto(created);
}

export interface CategoryUpdateResult {
  data: CategoryDto;
  previous: CategoryDto;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryUpdateResult> {
  const current = await findCategoryById(id);

  if (!current) {
    throw new HttpError(404, 'Категория не найдена');
  }

  const previous = toDto(current);

  await assertNameIsFree(input.name, id);

  const db = await getDb();
  await db.query('UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [
    input.name,
    id,
  ]);

  invalidateResourceListCache();

  const updated = await findCategoryById(id);

  if (!updated) {
    throw new HttpError(404, 'Категория не найдена');
  }

  return { data: toDto(updated), previous };
}

export interface DeleteCategoryResult {
  id: string;
  name: string;
  moved_resources: number;
}

/**
 * Удаляет категорию. Благодаря ON DELETE SET NULL все её ресурсы
 * автоматически переходят в «Без категории» — данные не теряются.
 */
export async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  const existing = await findCategoryById(id);

  if (!existing) {
    throw new HttpError(404, 'Категория не найдена');
  }

  const db = await getDb();
  const primary = await db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM resources WHERE category_id = ?',
    [id],
  );

  await db.transaction(async (tx) => {
    // Дополнительные категории на этом предмете больше не нужны — иначе
    // останутся «висячие» связи на удалённую категорию.
    await tx.query('DELETE FROM resource_categories WHERE category_id = ?', [id]);
    await tx.query('DELETE FROM categories WHERE id = ?', [id]);
  });

  invalidateResourceListCache();

  return {
    id,
    name: existing.name,
    moved_resources: Number(primary.rows[0]?.count ?? 0),
  };
}
