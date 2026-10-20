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

export async function listCategories(): Promise<CategoryDto[]> {
  const db = await getDb();
  const result = await db.query<CategoryRow>(
    `SELECT c.id,
            c.name,
            c.created_at,
            c.updated_at,
            COUNT(r.id)::int AS resource_count
       FROM categories AS c
       LEFT JOIN resources AS r ON r.category_id = c.id
      GROUP BY c.id, c.name, c.created_at, c.updated_at
      ORDER BY LOWER(c.name) ASC`,
  );

  return result.rows.map(toDto);
}

export async function createCategory(input: CategoryInput): Promise<CategoryDto> {
  const db = await getDb();

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
    [input.name],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Категория с таким названием уже существует');
  }

  const result = await db.query<CategoryRow>(
    `INSERT INTO categories (id, name)
     VALUES ($1, $2)
     RETURNING id, name, created_at, updated_at, 0::int AS resource_count`,
    [randomUUID(), input.name],
  );

  invalidateResourceListCache();

  return toDto(result.rows[0]!);
}

export interface CategoryUpdateResult {
  data: CategoryDto;
  previous: CategoryDto;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryUpdateResult> {
  const db = await getDb();

  const current = await db.query<CategoryRow>(
    `SELECT c.id,
            c.name,
            c.created_at,
            c.updated_at,
            COUNT(r.id)::int AS resource_count
       FROM categories AS c
       LEFT JOIN resources AS r ON r.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.created_at, c.updated_at`,
    [id],
  );

  if (!current.rows[0]) {
    throw new HttpError(404, 'Категория не найдена');
  }

  const previous = toDto(current.rows[0]);

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2',
    [input.name, id],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Категория с таким названием уже существует');
  }

  const result = await db.query<CategoryRow>(
    `UPDATE categories
        SET name = $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, created_at, updated_at,
                (SELECT COUNT(*)::int FROM resources WHERE category_id = $2) AS resource_count`,
    [input.name, id],
  );

  invalidateResourceListCache();

  return { data: toDto(result.rows[0]!), previous };
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
  const db = await getDb();

  const existing = await db.query<{ name: string }>(
    'SELECT name FROM categories WHERE id = $1',
    [id],
  );

  if (!existing.rows[0]) {
    throw new HttpError(404, 'Категория не найдена');
  }

  const affected = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM resources WHERE category_id = $1',
    [id],
  );

  const result = await db.query<{ id: string }>(
    'DELETE FROM categories WHERE id = $1 RETURNING id',
    [id],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, 'Категория не найдена');
  }

  invalidateResourceListCache();

  return {
    id,
    name: existing.rows[0].name,
    moved_resources: Number(affected.rows[0]?.count ?? 0),
  };
}
