import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Request } from 'express';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import { logger } from '../../utils/logger.js';
import { recordAudit } from '../audit/audit.service.js';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../uploads/upload.storage.js';
import { cropPng, decodePng } from './png.js';

const ICON_SIZE = 32;
const PRICE_ICON_DIR = join(UPLOADS_DIR, 'prices');
const PRICE_ICON_URL = `${UPLOADS_URL_PREFIX}/prices`;

export interface ImportItem {
  modid?: unknown;
  itemid?: unknown;
  damage?: unknown;
  name?: unknown;
  color?: unknown;
  name_color?: unknown;
  min_price?: unknown;
  max_price?: unknown;
  /** Точная ячейка спрайта (0-based), если её передаёт генератор прайса. */
  icon_index?: unknown;
}

export interface ImportSummary {
  job_id: string;
  status: 'done';
  total: number;
  created: number;
  updated: number;
  skipped: number;
  images: number;
  errors: string[];
}

export interface ImportJobDto {
  id: string;
  actor_login: string;
  actor_avatar_url: string | null;
  status: 'running' | 'done' | 'failed';
  source_name: string | null;
  total_items: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  image_count: number;
  error_count: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
}

interface ImportJobRow {
  id: string;
  actor_login: string;
  actor_avatar_url: string | null;
  status: 'running' | 'done' | 'failed';
  source_name: string | null;
  total_items: number | string;
  created_count: number | string;
  updated_count: number | string;
  skipped_count: number | string;
  image_count: number | string;
  error_count: number | string;
  errors: unknown;
  started_at: Date | string;
  finished_at: Date | string | null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function toJobDto(row: ImportJobRow): ImportJobDto {
  let errors: string[] | null = null;

  if (Array.isArray(row.errors)) {
    errors = row.errors.map((entry) => String(entry));
  } else if (typeof row.errors === 'string') {
    try {
      const parsed = JSON.parse(row.errors) as unknown;
      errors = Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : null;
    } catch {
      errors = null;
    }
  }

  return {
    id: row.id,
    actor_login: row.actor_login,
    actor_avatar_url: row.actor_avatar_url || null,
    status: row.status,
    source_name: row.source_name,
    total_items: Number(row.total_items),
    created_count: Number(row.created_count),
    updated_count: Number(row.updated_count),
    skipped_count: Number(row.skipped_count),
    image_count: Number(row.image_count),
    error_count: Number(row.error_count),
    errors,
    started_at: toIso(row.started_at),
    finished_at: row.finished_at ? toIso(row.finished_at) : null,
  };
}

function parseItems(payload: unknown): ImportItem[] {
  if (Array.isArray(payload)) return payload as ImportItem[];

  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: ImportItem[] }).items;
  }

  throw new HttpError(422, 'JSON должен содержать массив items');
}

function itemName(item: ImportItem): string {
  return typeof item.name === 'string' ? item.name.trim() : '';
}

function itemPrice(item: ImportItem): number | null {
  const value = Number(item.min_price);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function itemColor(item: ImportItem): string | null {
  const candidates = [item.name_color, item.color];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && HEX_COLOR.test(candidate.trim())) {
      return candidate.trim().toUpperCase();
    }
  }

  return null;
}

function modName(item: ImportItem): string {
  const raw = typeof item.modid === 'string' ? item.modid.trim() : '';
  const name = raw || 'Импорт прайса';
  return name.slice(0, 60);
}

function itemSourceKey(item: ImportItem, index: number): string {
  const itemid = typeof item.itemid === 'string' ? item.itemid.trim() : '';
  const damage = Number.isFinite(Number(item.damage)) ? Number(item.damage) : 0;

  if (itemid) return `${itemid}@${damage}`.slice(0, 200);
  return `${itemName(item) || 'item'}@${index}`.slice(0, 200);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function itemModKey(item: ImportItem): string {
  const raw = typeof item.modid === 'string' ? item.modid.trim() : '';
  return raw || '?';
}

function itemSpriteSortKey(item: ImportItem): [string, string, number] {
  return [
    (typeof item.name === 'string' ? item.name : '').toLowerCase(),
    (typeof item.itemid === 'string' ? item.itemid : '').toLowerCase(),
    Number.isFinite(Number(item.damage)) ? Number(item.damage) : 0,
  ];
}

/**
 * Порядок ячеек в icons.png задаёт HTML-прайс, а не JSON: моды идут по
 * убыванию числа предметов, внутри мода — по названию, itemid и damage.
 * Раньше импорт резал спрайт в порядке JSON, из-за чего почти все иконки
 * съезжали. Повторяем сортировку make_html.py (проверено на 9 252 позициях).
 */
function orderItemsForSprite(items: ImportItem[]): ImportItem[] {
  const groups = new Map<string, ImportItem[]>();

  for (const item of items) {
    const mod = itemModKey(item);
    const group = groups.get(mod);

    if (group) {
      group.push(item);
    } else {
      groups.set(mod, [item]);
    }
  }

  for (const group of groups.values()) {
    group.sort((a, b) => {
      const [nameA, idA, damageA] = itemSpriteSortKey(a);
      const [nameB, idB, damageB] = itemSpriteSortKey(b);

      return compareText(nameA, nameB) || compareText(idA, idB) || damageA - damageB;
    });
  }

  const mods = [...groups.keys()].sort((a, b) => {
    const bySize = groups.get(b)!.length - groups.get(a)!.length;
    return bySize !== 0 ? bySize : compareText(a.toLowerCase(), b.toLowerCase());
  });

  const ordered: ImportItem[] = [];

  for (const mod of mods) {
    ordered.push(...groups.get(mod)!);
  }

  return ordered;
}

/**
 * Если генератор прайса уже положил точные ячейки в `icon_index`,
 * используем их и не полагаемся на сортировку.
 */
function explicitIconIndexes(
  items: ImportItem[],
  cells: number,
): Map<ImportItem, number> | null {
  if (!items.some((item) => item.icon_index !== undefined)) return null;

  const indexes = new Map<ImportItem, number>();
  const used = new Set<number>();

  for (const item of items) {
    const value = Number(item.icon_index);

    if (!Number.isInteger(value) || value < 0 || value >= cells) {
      throw new HttpError(422, `Некорректный icon_index у «${itemName(item)}»`);
    }

    if (used.has(value)) {
      throw new HttpError(422, `icon_index ${value} повторяется в прайсе`);
    }

    used.add(value);
    indexes.set(item, value);
  }

  return indexes;
}

/** Один импорт за раз: иначе два запроса перетирают картинки друг друга. */
let importRunning = false;

async function nextCategoryId(
  db: Awaited<ReturnType<typeof getDb>>,
  cache: Map<string, string>,
  name: string,
): Promise<string> {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await db.query<{ id: string }>('SELECT id FROM categories WHERE name = ?', [
    name,
  ]);

  if (existing.rows[0]) {
    cache.set(key, existing.rows[0].id);
    return existing.rows[0].id;
  }

  const id = randomUUID();
  await db.query('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);

  cache.set(key, id);
  return id;
}

async function ensureSyncedActor(): Promise<{ id: string; login: string }> {
  const db = await getDb();
  const result = await db.query<{ id: string; login: string }>(
    "SELECT id, login FROM admin_users WHERE login = 'synced_' LIMIT 1",
  );

  if (!result.rows[0]) {
    throw new HttpError(500, 'Системный аккаунт synced_ не найден. Примените миграции');
  }

  return result.rows[0];
}

export async function runPriceImport(
  req: Request,
  pricesBuffer: Buffer,
  spriteBuffer: Buffer,
  sourceName: string,
): Promise<ImportSummary> {
  if (importRunning) {
    throw new HttpError(409, 'Импорт уже выполняется. Дождитесь завершения');
  }

  importRunning = true;
  const db = await getDb();
  const actor = await ensureSyncedActor();
  const jobId = randomUUID();

  await db.query(
    `INSERT INTO import_jobs (id, actor_login, status, source_name, started_at)
     VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP(3))`,
    [jobId, actor.login, sourceName],
  );

  const errors: string[] = [];
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let images = 0;

  try {
    let payload: unknown;

    try {
      payload = JSON.parse(pricesBuffer.toString('utf8'));
    } catch {
      throw new HttpError(422, 'Файл прайса не является корректным JSON');
    }

    const items = parseItems(payload);
    total = items.length;

    if (total === 0) {
      throw new HttpError(422, 'В прайсе нет ни одного предмета');
    }

    const sprite = decodePng(spriteBuffer);

    if (sprite.width % ICON_SIZE !== 0 || sprite.height % ICON_SIZE !== 0) {
      throw new HttpError(
        422,
        `Спрайт должен делиться на ячейки ${ICON_SIZE}×${ICON_SIZE} (сейчас ${sprite.width}×${sprite.height})`,
      );
    }

    const columns = sprite.width / ICON_SIZE;
    const cells = columns * (sprite.height / ICON_SIZE);

    if (cells < total) {
      throw new HttpError(
        422,
        `В спрайте ${cells} ячеек, а в прайсе ${total} предметов — нужен полный icons.png`,
      );
    }

    const iconIndexByItem =
      explicitIconIndexes(items, cells) ??
      new Map(orderItemsForSprite(items).map((item, index) => [item, index] as const));

    await mkdir(PRICE_ICON_DIR, { recursive: true });
    await writeFile(join(PRICE_ICON_DIR, 'icons.png'), spriteBuffer);

    const categoryCache = new Map<string, string>();
    const existing = await db.query<{ id: string; name: string; source_key: string | null }>(
      'SELECT id, name, source_key FROM resources',
    );
    const existingBySource = new Map<string, string>();
    const existingByName = new Map<string, string>();

    for (const row of existing.rows) {
      if (row.source_key) {
        existingBySource.set(row.source_key, row.id);
      } else {
        existingByName.set(row.name.toLowerCase(), row.id);
      }
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]!;
      const name = itemName(item);
      const price = itemPrice(item);

      if (name.length < 2) {
        skipped += 1;
        if (errors.length < 50) errors.push(`#${index + 1}: пустое название`);
        continue;
      }

      if (price === null) {
        skipped += 1;
        if (errors.length < 50) errors.push(`#${index + 1} «${name}»: нет положительной цены`);
        continue;
      }

      const spriteIndex = iconIndexByItem.get(item) ?? index;
      const column = spriteIndex % columns;
      const row = Math.floor(spriteIndex / columns);
      const iconName = `${String(spriteIndex + 1).padStart(5, '0')}.png`;
      const iconBuffer = cropPng(
        sprite,
        column * ICON_SIZE,
        row * ICON_SIZE,
        ICON_SIZE,
        ICON_SIZE,
      );

      await writeFile(join(PRICE_ICON_DIR, iconName), iconBuffer);
      images += 1;

      const categoryId = await nextCategoryId(db, categoryCache, modName(item));
      const imageUrl = `${PRICE_ICON_URL}/${iconName}`;
      const nameColor = itemColor(item);
      // Колонка resources.min_price — NUMERIC(18,2) с CHECK > 0.
      // Цены из прайса бывают меньше копейки, поэтому минимально допустимая — 0.01.
      const storedPrice = Math.max(0.01, Math.round(price * 100) / 100);
      const sourceKey = itemSourceKey(item, index);
      const nameKey = name.toLowerCase();
      const existingId =
        existingBySource.get(sourceKey) ?? existingByName.get(nameKey);

      if (existingId) {
        if (!existingBySource.has(sourceKey)) {
          // Ручной ресурс или строка из импорта до миграции 007: забираем её
          // под source_key, чтобы следующие предметы с тем же названием
          // добавились отдельными строками.
          existingByName.delete(nameKey);
        }

        await db.query(
          `UPDATE resources
              SET name_color = ?,
                  min_price = ?,
                  image_url = ?,
                  category_id = ?,
                  source_key = ?,
                  updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?`,
          [nameColor, storedPrice, imageUrl, categoryId, sourceKey, existingId],
        );
        existingBySource.set(sourceKey, existingId);
        updated += 1;
      } else {
        const id = randomUUID();
        await db.query(
          `INSERT INTO resources
             (id, name, name_color, min_price, image_url, category_id, source_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, name, nameColor, storedPrice, imageUrl, categoryId, sourceKey],
        );
        existingBySource.set(sourceKey, id);
        created += 1;
      }
    }

    await db.query(
      `UPDATE import_jobs
          SET status = 'done',
              total_items = ?,
              created_count = ?,
              updated_count = ?,
              skipped_count = ?,
              image_count = ?,
              error_count = ?,
              errors = ?,
              finished_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?`,
      [
        total,
        created,
        updated,
        skipped,
        images,
        errors.length,
        JSON.stringify(errors),
        jobId,
      ],
    );

    await recordAudit(req, {
      action: 'import.prices',
      actor: { id: actor.id, login: actor.login },
      entityType: 'import',
      entityId: jobId,
      entityLabel: sourceName.slice(0, 200),
      details: {
        total,
        created,
        updated,
        skipped,
        images,
        error_count: errors.length,
      },
    });

    return {
      job_id: jobId,
      status: 'done',
      total,
      created,
      updated,
      skipped,
      images,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка импорта';

    await db
      .query(
        `UPDATE import_jobs
            SET status = 'failed',
                total_items = ?,
                created_count = ?,
                updated_count = ?,
                skipped_count = ?,
                image_count = ?,
                error_count = ?,
                errors = ?,
                finished_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?`,
        [total, created, updated, skipped, images, 1, JSON.stringify([message]), jobId],
      )
      .catch((dbError) => logger.error('Не удалось обновить статус импорта:', dbError));

    await recordAudit(req, {
      action: 'import.prices_failed',
      actor: { id: actor.id, login: actor.login },
      entityType: 'import',
      entityId: jobId,
      entityLabel: sourceName.slice(0, 200),
      details: { error: message, total, created, updated },
    }).catch(() => {});

    throw error;
  } finally {
    importRunning = false;
  }
}

export async function listImportJobs(limit = 20): Promise<ImportJobDto[]> {
  const db = await getDb();
  const result = await db.query<ImportJobRow>(
    `SELECT j.*,
            (SELECT u.avatar_url FROM admin_users AS u WHERE u.login = j.actor_login) AS actor_avatar_url
       FROM import_jobs AS j
      ORDER BY j.started_at DESC
      LIMIT ?`,
    [limit],
  );

  return result.rows.map(toJobDto);
}
