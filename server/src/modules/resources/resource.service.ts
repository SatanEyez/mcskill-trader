import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import { escapeLike } from '../../utils/sql.js';
import {
  invalidateResourceListCache,
  readCatalogCache,
  readResourceListCache,
  writeCatalogCache,
  writeResourceListCache,
  type ResourceListResult,
} from './resource.cache.js';
import type {
  ListResourcesQuery,
  ResourceDto,
  ResourceInput,
  ResourceRow,
  ResourceSort,
  ResourceStats,
  ResourceUpdate,
} from './resource.types.js';

const SORT_SQL: Record<ResourceSort, string> = {
  name_asc: 'LOWER(r.name) ASC',
  price_asc: 'r.min_price ASC',
  price_desc: 'r.min_price DESC',
  newest: 'r.created_at DESC',
};

const RESOURCE_SELECT = `
  SELECT r.id,
         r.name,
         r.name_color,
         r.min_price,
         r.image_url,
         r.category_id,
         c.name AS category_name,
         r.created_at,
         r.updated_at
    FROM resources AS r
    LEFT JOIN categories AS c ON c.id = r.category_id
`;

const NAME_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Цвет названия принимаем только в виде #RRGGBB или null.
 * Проверка здесь, а не в Zod: для некорректного цвета API отвечает 400.
 */
function assertNameColor(nameColor: string | null | undefined): void {
  if (nameColor === null || nameColor === undefined) return;

  if (!NAME_COLOR_PATTERN.test(nameColor)) {
    throw new HttpError(400, 'Цвет названия должен быть в формате #RRGGBB или null');
  }
}

function toDto(row: ResourceRow): ResourceDto {
  return {
    id: row.id,
    name: row.name,
    name_color: row.name_color,
    min_price: Math.round(Number(row.min_price) * 100) / 100,
    image_url: row.image_url,
    category_id: row.category_id,
    category: row.category_name ?? 'Без категории',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

async function assertCategoryExists(categoryId: string | null): Promise<void> {
  if (categoryId === null) return;

  const db = await getDb();
  const result = await db.query<{ id: string }>('SELECT id FROM categories WHERE id = $1', [
    categoryId,
  ]);

  if (result.rows.length === 0) {
    throw new HttpError(400, 'Категория не найдена');
  }
}

export async function listResources(query: ListResourcesQuery): Promise<ResourceListResult> {
  const cached = readResourceListCache(query);
  if (cached) return cached;

  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.search) {
    params.push(`%${escapeLike(query.search)}%`);
    conditions.push(`r.name ILIKE $${params.length} ESCAPE '!'`);
  }

  if (query.category_id) {
    params.push(query.category_id);
    conditions.push(`r.category_id = $${params.length}`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderSql = SORT_SQL[query.sort] ?? SORT_SQL.name_asc;

  params.push(query.limit);
  const limitPosition = params.length;
  params.push((query.page - 1) * query.limit);
  const offsetPosition = params.length;

  const rows = await db.query<ResourceRow>(
    `SELECT r.id,
            r.name,
            r.name_color,
            r.min_price,
            r.image_url,
            r.category_id,
            c.name AS category_name,
            r.created_at,
            r.updated_at,
            COUNT(*) OVER() AS total_count
       FROM resources AS r
       LEFT JOIN categories AS c ON c.id = r.category_id
       ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
    params,
  );

  const total = Number(rows.rows[0]?.total_count ?? 0);
  const result: ResourceListResult = {
    data: rows.rows.map(toDto),
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };

  writeResourceListCache(query, result);

  return result;
}

/**
 * Полный компактный каталог для трейд-калькулятора.
 * Нужен целиком: локальный расчёт и восстановление сохранённого обмена
 * не должны зависеть от текущей страницы каталога.
 */
export async function listCatalog(): Promise<ResourceDto[]> {
  const cached = readCatalogCache();
  if (cached) return cached;

  const db = await getDb();
  const rows = await db.query<ResourceRow>(
    `${RESOURCE_SELECT} ORDER BY LOWER(r.name) ASC`,
  );
  const data = rows.rows.map(toDto);

  writeCatalogCache(data);
  return data;
}

export async function getResourceStats(): Promise<ResourceStats> {
  const db = await getDb();

  const totals = await db.query<{
    total: number;
    min_price: string | number | null;
    avg_price: string | number | null;
  }>(
    `SELECT COUNT(*)::int AS total,
            MIN(min_price) AS min_price,
            AVG(min_price) AS avg_price
       FROM resources`,
  );

  const expensive = await db.query<{ name: string; min_price: string | number }>(
    `SELECT name, min_price
       FROM resources
      ORDER BY min_price DESC
      LIMIT 1`,
  );

  const categories = await db.query<{ id: string; name: string; count: number }>(
    `SELECT c.id,
            c.name,
            COUNT(r.id)::int AS count
       FROM categories AS c
       LEFT JOIN resources AS r ON r.category_id = c.id
      GROUP BY c.id, c.name
     HAVING COUNT(r.id) > 0
      ORDER BY COUNT(r.id) DESC, LOWER(c.name) ASC`,
  );

  const row = totals.rows[0];
  const minPrice = row?.min_price === null || row?.min_price === undefined
    ? null
    : Math.round(Number(row.min_price) * 100) / 100;
  const avgPrice = row?.avg_price === null || row?.avg_price === undefined
    ? null
    : Math.round(Number(row.avg_price) * 100) / 100;

  return {
    total: Number(row?.total ?? 0),
    min_price: minPrice,
    avg_price: avgPrice,
    most_expensive: expensive.rows[0]
      ? {
          name: expensive.rows[0].name,
          min_price: Math.round(Number(expensive.rows[0].min_price) * 100) / 100,
        }
      : null,
    categories: categories.rows.map((category) => ({
      id: category.id,
      name: category.name,
      count: Number(category.count),
    })),
  };
}

export async function getResourceById(id: string): Promise<ResourceDto> {
  const db = await getDb();
  const result = await db.query<ResourceRow>(`${RESOURCE_SELECT} WHERE r.id = $1`, [id]);
  const row = result.rows[0];

  if (!row) {
    throw new HttpError(404, 'Ресурс не найден');
  }

  return toDto(row);
}

export async function createResource(input: ResourceInput): Promise<ResourceDto> {
  assertNameColor(input.name_color);
  await assertCategoryExists(input.category_id);
  const db = await getDb();
  const result = await db.query<{ id: string }>(
    `INSERT INTO resources (id, name, name_color, min_price, image_url, category_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      randomUUID(),
      input.name,
      input.name_color,
      input.min_price,
      input.image_url,
      input.category_id,
    ],
  );

  invalidateResourceListCache();

  return getResourceById(result.rows[0]!.id);
}

export interface ResourceUpdateResult {
  data: ResourceDto;
  previous: ResourceDto;
}

export async function updateResource(
  id: string,
  input: ResourceUpdate,
): Promise<ResourceUpdateResult> {
  const current = await getResourceById(id);
  const nextCategoryId =
    input.category_id !== undefined ? input.category_id : current.category_id;

  await assertCategoryExists(nextCategoryId);

  const next = {
    name: input.name ?? current.name,
    name_color: input.name_color !== undefined ? input.name_color : current.name_color,
    min_price: input.min_price ?? current.min_price,
    image_url: input.image_url ?? current.image_url,
    category_id: nextCategoryId,
  };

  assertNameColor(next.name_color);

  const db = await getDb();
  await db.query(
    `UPDATE resources
        SET name = $1,
            name_color = $2,
            min_price = $3,
            image_url = $4,
            category_id = $5,
            updated_at = NOW()
      WHERE id = $6`,
    [next.name, next.name_color, next.min_price, next.image_url, next.category_id, id],
  );

  invalidateResourceListCache();

  return { data: await getResourceById(id), previous: current };
}

export async function deleteResource(id: string): Promise<ResourceDto> {
  const current = await getResourceById(id);
  const db = await getDb();
  const result = await db.query<{ id: string }>(
    'DELETE FROM resources WHERE id = $1 RETURNING id',
    [id],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, 'Ресурс не найден');
  }

  invalidateResourceListCache();

  return current;
}
