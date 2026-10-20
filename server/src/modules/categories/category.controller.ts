import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { logAction } from '../audit/audit.service.js';
import { categoryIdParamSchema, createCategorySchema, updateCategorySchema } from './category.schema.js';
import * as categoryService from './category.service.js';
import type { CategoryInput } from './category.types.js';

type CategoryBody = z.infer<typeof createCategorySchema>;
type CategoryParams = z.infer<typeof categoryIdParamSchema>;

function getId(req: Request): string {
  return (req.validatedParams as CategoryParams).id;
}

export const listCategories: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await categoryService.listCategories();
  res.json({ data });
});

export const createCategory: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as CategoryBody;
  const data = await categoryService.createCategory(body as CategoryInput);

  await logAction(req, {
    action: 'category.create',
    entityType: 'category',
    entityId: data.id,
    entityLabel: data.name,
    details: { name: data.name },
  });

  res.status(201).json({ data });
});

export const updateCategory: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as z.infer<typeof updateCategorySchema>;
  const { data, previous } = await categoryService.updateCategory(getId(req), body as CategoryInput);

  if (previous.name !== data.name) {
    await logAction(req, {
      action: 'category.update',
      entityType: 'category',
      entityId: data.id,
      entityLabel: data.name,
      details: { changes: { name: { from: previous.name, to: data.name } } },
    });
  }

  res.json({ data });
});

export const deleteCategory: RequestHandler = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(getId(req));

  await logAction(req, {
    action: 'category.delete',
    entityType: 'category',
    entityId: result.id,
    entityLabel: result.name,
    details: {
      name: result.name,
      moved_resources: result.moved_resources,
    },
  });

  res.json({ data: { id: result.id, moved_resources: result.moved_resources } });
});
