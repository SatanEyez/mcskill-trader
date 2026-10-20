import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createPrefix,
  createRole,
  deletePrefix,
  deleteRole,
  listPrefixes,
  listRoles,
  updatePrefix,
  updateRole,
} from './access.controller.js';
import {
  createPrefixSchema,
  createRoleSchema,
  prefixIdParamSchema,
  roleIdParamSchema,
  updatePrefixSchema,
  updateRoleSchema,
} from './access.schema.js';

export const roleRouter = Router();
roleRouter.use(requireAdmin);

// Список ролей нужен и для назначения доступа на странице пользователей.
roleRouter.get('/', listRoles);
roleRouter.post('/', requirePermission('roles.manage'), validate(createRoleSchema), createRole);
roleRouter.put(
  '/:id',
  requirePermission('roles.manage'),
  validate(roleIdParamSchema, 'params'),
  validate(updateRoleSchema),
  updateRole,
);
roleRouter.delete(
  '/:id',
  requirePermission('roles.manage'),
  validate(roleIdParamSchema, 'params'),
  deleteRole,
);

export const prefixRouter = Router();
prefixRouter.use(requireAdmin);

prefixRouter.get('/', listPrefixes);
prefixRouter.post(
  '/',
  requirePermission('prefixes.manage'),
  validate(createPrefixSchema),
  createPrefix,
);
prefixRouter.put(
  '/:id',
  requirePermission('prefixes.manage'),
  validate(prefixIdParamSchema, 'params'),
  validate(updatePrefixSchema),
  updatePrefix,
);
prefixRouter.delete(
  '/:id',
  requirePermission('prefixes.manage'),
  validate(prefixIdParamSchema, 'params'),
  deletePrefix,
);
