import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { logAction } from '../audit/audit.service.js';
import * as newsService from './news.service.js';
import type { CreateNewsInput, ListNewsQuery, UpdateNewsInput } from './news.schema.js';

function newsId(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}

export const listNews: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListNewsQuery;
  const result = await newsService.listPublishedNews(query);

  res.json({
    data: result.data,
    meta: { total: result.total, count: result.data.length, limit: query.limit, offset: query.offset },
  });
});

export const listNewsAdmin: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListNewsQuery;
  const result = await newsService.listAllNews(query);

  res.json({
    data: result.data,
    meta: { total: result.total, count: result.data.length, limit: query.limit, offset: query.offset },
  });
});

export const getNewsPost: RequestHandler = asyncHandler(async (req, res) => {
  const data = await newsService.getNews(newsId(req), { includeDrafts: Boolean(req.auth) });

  // Просмотр считаем только для опубликованных новостей. Счётчик увеличиваем
  // до ответа, чтобы клиент сразу видел актуальное число.
  if (data.is_published) {
    await newsService.incrementNewsViews(data.id).catch(() => undefined);
    data.views += 1;
  }

  res.json({ data });
});

export const createNewsPost: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validatedBody as CreateNewsInput;
  const data = await newsService.createNews(input, req.auth!);

  await logAction(req, {
    action: 'news.create',
    entityType: 'news',
    entityId: data.id,
    entityLabel: data.title,
    details: { published: data.is_published, image: Boolean(data.image_url) },
  });

  res.status(201).json({ data });
});

export const updateNewsPost: RequestHandler = asyncHandler(async (req, res) => {
  const { data, previous } = await newsService.updateNews(
    newsId(req),
    req.validatedBody as UpdateNewsInput,
    req.auth!,
  );

  await logAction(req, {
    action: 'news.update',
    entityType: 'news',
    entityId: data.id,
    entityLabel: data.title,
    details: {
      title: { from: previous.title, to: data.title },
      published: { from: previous.is_published, to: data.is_published },
    },
  });

  res.json({ data });
});

export const deleteNewsPost: RequestHandler = asyncHandler(async (req, res) => {
  const previous = await newsService.deleteNews(newsId(req));

  await logAction(req, {
    action: 'news.delete',
    entityType: 'news',
    entityId: previous.id,
    entityLabel: previous.title,
    details: { published: previous.is_published },
  });

  res.json({ data: previous });
});
