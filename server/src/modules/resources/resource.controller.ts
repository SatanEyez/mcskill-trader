import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireUuid } from '../../utils/uuid.js';
import { logAction } from '../audit/audit.service.js';
import { createResourceSchema, updateResourceSchema } from './resource.schema.js';
import * as resourceService from './resource.service.js';
import type {
  ListResourcesQuery,
  ResourceDto,
  ResourceInput,
  ResourceUpdate,
} from './resource.types.js';

type CreateBody = z.infer<typeof createResourceSchema>;
type UpdateBody = z.infer<typeof updateResourceSchema>;

interface FieldChange {
  from: string | number | null;
  to: string | number | null;
}

function getId(req: Request): string {
  return requireUuid(req.params.id as string, 'идентификатор ресурса');
}

/** Только реально изменённые поля — чтобы в журнале не было шума. */
function describeChanges(previous: ResourceDto, next: ResourceDto): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  if (previous.name !== next.name) {
    changes.name = { from: previous.name, to: next.name };
  }

  if (previous.name_color !== next.name_color) {
    changes.name_color = { from: previous.name_color, to: next.name_color };
  }

  if (previous.min_price !== next.min_price) {
    changes.min_price = { from: previous.min_price, to: next.min_price };
  }

  if (previous.image_url !== next.image_url) {
    changes.image_url = { from: previous.image_url, to: next.image_url };
  }

  if (previous.category !== next.category) {
    changes.category = { from: previous.category, to: next.category };
  }

  const previousCategories = previous.categories.map((item) => item.name).join(', ');
  const nextCategories = next.categories.map((item) => item.name).join(', ');

  if (previousCategories !== nextCategories) {
    changes.categories = { from: previousCategories, to: nextCategories };
  }

  return changes;
}

export const listResources: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListResourcesQuery;
  const result = await resourceService.listResources(query);

  res.json({
    data: result.data,
    meta: {
      total: result.total,
      count: result.data.length,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    },
  });
});

export const getCatalog: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await resourceService.listCatalog();
  res.json({ data, meta: { total: data.length, count: data.length } });
});

export const getStats: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await resourceService.getResourceStats() });
});

export const getResource: RequestHandler = asyncHandler(async (req, res) => {
  const data = await resourceService.getResourceById(getId(req));
  res.json({ data });
});

export const createResource: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as CreateBody;
  const data = await resourceService.createResource(body as ResourceInput);

  await logAction(req, {
    action: 'resource.create',
    entityType: 'resource',
    entityId: data.id,
    entityLabel: data.name,
    details: {
      min_price: data.min_price,
      category: data.category,
      categories: data.categories.map((item) => item.name).join(', '),
      image_url: data.image_url,
      name_color: data.name_color,
    },
  });

  res.status(201).json({ data });
});

export const updateResource: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as UpdateBody;
  const { data, previous } = await resourceService.updateResource(
    getId(req),
    body as ResourceUpdate,
  );
  const changes = describeChanges(previous, data);

  if (Object.keys(changes).length > 0) {
    await logAction(req, {
      action: 'resource.update',
      entityType: 'resource',
      entityId: data.id,
      entityLabel: data.name,
      details: { changes },
    });
  }

  res.json({ data });
});

export const deleteResource: RequestHandler = asyncHandler(async (req, res) => {
  const deleted = await resourceService.deleteResource(getId(req), req.auth!);

  await logAction(req, {
    action: 'resource.delete',
    entityType: 'resource',
    entityId: deleted.id,
    entityLabel: deleted.name,
    details: {
      min_price: deleted.min_price,
      category: deleted.category,
      name_color: deleted.name_color,
    },
  });

  res.json({ data: { id: deleted.id } });
});

export const bulkDeleteResources: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as { ids: string[] };
  const result = await resourceService.deleteResources(body.ids, req.auth!);
  const label =
    result.deleted.length === 1
      ? result.deleted[0]!.name
      : `Удалено предметов: ${result.deleted.length}`;

  await logAction(req, {
    action: 'resource.delete',
    entityType: 'resource',
    entityId: null,
    entityLabel: label,
    details: {
      bulk: true,
      count: result.deleted.length,
      ids: result.deleted.map((item) => item.id),
      names: result.deleted.slice(0, 50).map((item) => item.name),
    },
  });

  res.json({
    data: {
      deleted: result.deleted.map((item) => item.id),
      count: result.deleted.length,
    },
  });
});

export const listExcludedResources: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await resourceService.listExcludedResources() });
});

export const restoreExcludedResource: RequestHandler = asyncHandler(async (req, res) => {
  const data = await resourceService.restoreExcludedResource(
    requireUuid(req.params.id as string, 'идентификатор удалённого предмета'),
  );

  await logAction(req, {
    action: 'resource.restore',
    entityType: 'resource',
    entityId: data.id,
    entityLabel: data.name,
    details: {
      min_price: data.min_price,
      category: data.category,
    },
  });

  res.json({ data });
});

export const removeExcludedResource: RequestHandler = asyncHandler(async (req, res) => {
  const removed = await resourceService.removeExcludedResource(
    requireUuid(req.params.id as string, 'идентификатор удалённого предмета'),
  );

  await logAction(req, {
    action: 'resource.exclusion_delete',
    entityType: 'resource',
    entityId: removed.id,
    entityLabel: removed.name,
  });

  res.json({ data: { id: removed.id } });
});
