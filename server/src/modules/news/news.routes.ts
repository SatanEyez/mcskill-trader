import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createNewsPost,
  deleteNewsPost,
  getNewsPost,
  listNews,
  listNewsAdmin,
  updateNewsPost,
} from './news.controller.js';
import {
  createNewsSchema,
  listNewsQuerySchema,
  newsIdParamSchema,
  updateNewsSchema,
} from './news.schema.js';

export const newsRouter = Router();

// Публичная лента.
newsRouter.get('/', validate(listNewsQuerySchema, 'query'), listNews);

// Админский список — до `/:id`, иначе «all» уйдёт в параметр id.
newsRouter.get(
  '/all',
  requireAdmin,
  requirePermission('news.write'),
  validate(listNewsQuerySchema, 'query'),
  listNewsAdmin,
);

newsRouter.get('/:id', validate(newsIdParamSchema, 'params'), getNewsPost);

newsRouter.post(
  '/',
  requireAdmin,
  requirePermission('news.write'),
  validate(createNewsSchema),
  createNewsPost,
);

newsRouter.put(
  '/:id',
  requireAdmin,
  requirePermission('news.write'),
  validate(newsIdParamSchema, 'params'),
  validate(updateNewsSchema),
  updateNewsPost,
);

newsRouter.delete(
  '/:id',
  requireAdmin,
  requirePermission('news.write'),
  validate(newsIdParamSchema, 'params'),
  deleteNewsPost,
);
