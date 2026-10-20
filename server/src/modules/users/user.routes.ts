import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  approveUser,
  deleteUser,
  listUsers,
  rejectUser,
  updateUserAccess,
  updateUserRole,
} from './user.controller.js';
import {
  listUsersQuerySchema,
  updateUserAccessSchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from './user.schema.js';

export const userRouter = Router();

// Управление администраторами доступно только действующим администраторам.
userRouter.use(requireAdmin);

userRouter.get(
  '/',
  requirePermission('users.read'),
  validate(listUsersQuerySchema, 'query'),
  listUsers,
);
userRouter.post(
  '/:id/approve',
  requirePermission('users.write'),
  validate(userIdParamSchema, 'params'),
  approveUser,
);
userRouter.post(
  '/:id/reject',
  requirePermission('users.write'),
  validate(userIdParamSchema, 'params'),
  rejectUser,
);
// Смена «полного доступа» и гибкой роли — отдельное право.
userRouter.put(
  '/:id/role',
  requirePermission('users.roles'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserRoleSchema),
  updateUserRole,
);
userRouter.put(
  '/:id/access',
  requirePermission('users.roles'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserAccessSchema),
  updateUserAccess,
);
userRouter.delete(
  '/:id',
  requirePermission('users.write'),
  validate(userIdParamSchema, 'params'),
  deleteUser,
);
