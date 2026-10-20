import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './category.controller.js';
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from './category.schema.js';

export const categoryRouter = Router();

// Публичный список нужен для фильтров на сайте и формы ресурса.
categoryRouter.get('/', listCategories);

// Управление категориями доступно администратору с правом categories.write.
categoryRouter.post(
  '/',
  requireAdmin,
  requirePermission('categories.write'),
  validate(createCategorySchema),
  createCategory,
);
categoryRouter.put(
  '/:id',
  requireAdmin,
  requirePermission('categories.write'),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema),
  updateCategory,
);
categoryRouter.delete(
  '/:id',
  requireAdmin,
  requirePermission('categories.write'),
  validate(categoryIdParamSchema, 'params'),
  deleteCategory,
);
