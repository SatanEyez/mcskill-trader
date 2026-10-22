import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { logAction } from '../audit/audit.service.js';
import { PERMISSIONS } from './permissions.js';
import * as accessService from './access.service.js';
import type {
  CreatePrefixInput,
  CreateRoleInput,
  UpdatePrefixInput,
  UpdateRoleInput,
} from './access.schema.js';

function roleId(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}

export const listRoles: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await accessService.listRoles();
  res.json({ data, meta: { permissions: PERMISSIONS } });
});

export const createRole: RequestHandler = asyncHandler(async (req, res) => {
  const data = await accessService.createRole(req.validatedBody as CreateRoleInput);

  await logAction(req, {
    action: 'access.role_create',
    entityType: 'role',
    entityId: data.id,
    entityLabel: data.name,
    details: { code: data.code, permissions: data.permissions, access_level: data.access_level },
  });

  res.status(201).json({ data });
});

export const updateRole: RequestHandler = asyncHandler(async (req, res) => {
  const { data, previous } = await accessService.updateRole(
    roleId(req),
    req.validatedBody as UpdateRoleInput,
  );

  await logAction(req, {
    action: 'access.role_update',
    entityType: 'role',
    entityId: data.id,
    entityLabel: data.name,
    details: {
      name: { from: previous.name, to: data.name },
      permissions: { from: previous.permissions, to: data.permissions },
      access_level: { from: previous.access_level, to: data.access_level },
    },
  });

  res.json({ data });
});

export const deleteRole: RequestHandler = asyncHandler(async (req, res) => {
  const data = await accessService.deleteRole(roleId(req));

  await logAction(req, {
    action: 'access.role_delete',
    entityType: 'role',
    entityId: data.id,
    entityLabel: data.name,
    details: { code: data.code, user_count: data.user_count },
  });

  res.json({ data });
});

function prefixId(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}

export const listPrefixes: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await accessService.listPrefixes() });
});

export const createPrefix: RequestHandler = asyncHandler(async (req, res) => {
  const data = await accessService.createPrefix(req.validatedBody as CreatePrefixInput);

  await logAction(req, {
    action: 'access.prefix_create',
    entityType: 'prefix',
    entityId: data.id,
    entityLabel: data.name,
    details: { color: data.color, priority: data.priority, is_shiny: data.is_shiny },
  });

  res.status(201).json({ data });
});

export const updatePrefix: RequestHandler = asyncHandler(async (req, res) => {
  const { data, previous } = await accessService.updatePrefix(
    prefixId(req),
    req.validatedBody as UpdatePrefixInput,
  );

  await logAction(req, {
    action: 'access.prefix_update',
    entityType: 'prefix',
    entityId: data.id,
    entityLabel: data.name,
    details: {
      name: { from: previous.name, to: data.name },
      color: { from: previous.color, to: data.color },
      priority: { from: previous.priority, to: data.priority },
      is_shiny: { from: previous.is_shiny, to: data.is_shiny },
    },
  });

  res.json({ data });
});

export const deletePrefix: RequestHandler = asyncHandler(async (req, res) => {
  const data = await accessService.deletePrefix(prefixId(req));

  await logAction(req, {
    action: 'access.prefix_delete',
    entityType: 'prefix',
    entityId: data.id,
    entityLabel: data.name,
    details: { color: data.color },
  });

  res.json({ data });
});
