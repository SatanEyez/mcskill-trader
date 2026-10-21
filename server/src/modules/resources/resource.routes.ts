import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createResource,
  deleteResource,
  getCatalog,
  getResource,
  getStats,
  listExcludedResources,
  listResources,
  restoreExcludedResource,
  updateResource,
} from './resource.controller.js';
import {
  createResourceSchema,
  listResourcesQuerySchema,
  updateResourceSchema,
} from './resource.schema.js';

export const resourceRouter = Router();

// Публичные маршруты
resourceRouter.get('/', validate(listResourcesQuerySchema, 'query'), listResources);
resourceRouter.get('/catalog', getCatalog);
resourceRouter.get('/stats', getStats);
// Стоп-лист импорта — строго до /:id, иначе «exclusions» попадёт в getId.
resourceRouter.get(
  '/exclusions',
  requireAdmin,
  requirePermission('resources.delete'),
  listExcludedResources,
);
resourceRouter.post(
  '/exclusions/:id/restore',
  requireAdmin,
  requirePermission('resources.delete'),
  restoreExcludedResource,
);
resourceRouter.get('/:id', getResource);

// Маршруты только для администратора
resourceRouter.post(
  '/',
  requireAdmin,
  requirePermission('resources.write'),
  validate(createResourceSchema),
  createResource,
);
resourceRouter.put(
  '/:id',
  requireAdmin,
  requirePermission('resources.write'),
  validate(updateResourceSchema),
  updateResource,
);
resourceRouter.delete(
  '/:id',
  requireAdmin,
  requirePermission('resources.delete'),
  deleteResource,
);
