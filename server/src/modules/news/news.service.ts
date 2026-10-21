import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import type { NewsListResult, NewsPostDto, NewsRow } from './news.types.js';
import type { CreateNewsInput, ListNewsQuery, UpdateNewsInput } from './news.schema.js';

function toDto(row: NewsRow): NewsPostDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    image_url: row.image_url || null,
    is_published: Boolean(row.is_published),
    views: Number(row.views),
    created_by_login: row.created_by_login,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    published_at: row.published_at ? toIso(row.published_at) : null,
  };
}

/** Публичная лента: только опубликованные, свежие сверху. */
export async function listPublishedNews(query: ListNewsQuery): Promise<NewsListResult> {
  const db = await getDb();
  const result = await db.query<NewsRow>(
    `SELECT id, title, body, image_url, is_published, views, created_by_login,
            created_at, updated_at, published_at,
            COUNT(*) OVER() AS total_count
       FROM news_posts
      WHERE is_published = 1
      ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
      LIMIT ? OFFSET ?`,
    [query.limit, query.offset],
  );

  return {
    data: result.rows.map(toDto),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

/** Админский список: черновики тоже видны. */
export async function listAllNews(query: ListNewsQuery): Promise<NewsListResult> {
  const db = await getDb();
  const result = await db.query<NewsRow>(
    `SELECT id, title, body, image_url, is_published, views, created_by_login,
            created_at, updated_at, published_at,
            COUNT(*) OVER() AS total_count
       FROM news_posts
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [query.limit, query.offset],
  );

  return {
    data: result.rows.map(toDto),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

export async function getNews(id: string, options: { includeDrafts?: boolean } = {}): Promise<NewsPostDto> {
  const db = await getDb();
  const result = await db.query<NewsRow>(
    `SELECT id, title, body, image_url, is_published, views, created_by_login,
            created_at, updated_at, published_at
       FROM news_posts
      WHERE id = ?`,
    [id],
  );
  const row = result.rows[0];

  if (!row) throw new HttpError(404, 'Новость не найдена');
  if (!Boolean(row.is_published) && !options.includeDrafts) {
    throw new HttpError(404, 'Новость не найдена');
  }

  return toDto(row);
}

export async function incrementNewsViews(id: string): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE news_posts SET views = views + 1 WHERE id = ?', [id]);
}

export async function createNews(input: CreateNewsInput, actor: AuthPayload): Promise<NewsPostDto> {
  const db = await getDb();
  const id = randomUUID();

  await db.query(
    `INSERT INTO news_posts
       (id, title, body, image_url, is_published, created_by, created_by_login, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${input.is_published ? 'CURRENT_TIMESTAMP(3)' : 'NULL'})`,
    [
      id,
      input.title,
      input.body,
      input.image_url || null,
      input.is_published ? 1 : 0,
      actor.sub,
      actor.login,
    ],
  );

  return getNews(id, { includeDrafts: true });
}

export interface NewsUpdateResult {
  data: NewsPostDto;
  previous: NewsPostDto;
}

export async function updateNews(
  id: string,
  input: UpdateNewsInput,
  _actor: AuthPayload,
): Promise<NewsUpdateResult> {
  const previous = await getNews(id, { includeDrafts: true });

  const title = input.title ?? previous.title;
  const body = input.body ?? previous.body;
  const imageUrl = input.image_url === undefined ? previous.image_url : input.image_url || null;
  const isPublished = input.is_published ?? previous.is_published;

  const db = await getDb();
  await db.query(
    `UPDATE news_posts
        SET title = ?,
            body = ?,
            image_url = ?,
            is_published = ?,
            published_at = CASE
              WHEN ? = 0 THEN NULL
              WHEN published_at IS NULL THEN CURRENT_TIMESTAMP(3)
              ELSE published_at
            END,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [title, body, imageUrl, isPublished ? 1 : 0, isPublished ? 1 : 0, id],
  );

  return { data: await getNews(id, { includeDrafts: true }), previous };
}

export async function deleteNews(id: string): Promise<NewsPostDto> {
  const previous = await getNews(id, { includeDrafts: true });

  const db = await getDb();
  await db.query('DELETE FROM news_posts WHERE id = ?', [id]);

  return previous;
}
