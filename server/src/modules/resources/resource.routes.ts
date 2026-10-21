import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  bulkDeleteResources,
  createResource,
  deleteResource,
  getCatalog,
  getResource,
  getStats,
  listExcludedResources,
  listResources,
  removeExcludedResource,
  restoreExcludedResource,
  updateResource,
} from './resource.controller.js';
import {
  bulkDeleteResourcesSchema,
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
resourceRouter.delete(
  '/exclusions/:id',
  requireAdmin,
  requirePermission('resources.delete'),
  removeExcludedResource,
);
// Массовое удаление — строго до /:id, чтобы «bulk-delete» не улетел в getId.
resourceRouter.post(
  '/bulk-delete',
  requireAdmin,
  requirePermission('resources.delete'),
  validate(bulkDeleteResourcesSchema),
  bulkDeleteResources,
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
