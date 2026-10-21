import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { createImageUploader } from '../uploads/upload.middleware.js';
import {
  approveUser,
  deleteAvatar,
  deleteUser,
  listUsers,
  rejectUser,
  updateAvatar,
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

// Свой профиль: любой действующий администратор может сменить себе аватар.
userRouter.put('/me/avatar', createImageUploader('avatar', 2 * 1024 * 1024), updateAvatar);
userRouter.delete('/me/avatar', deleteAvatar);

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
  requirePermission('users.delete'),
  validate(userIdParamSchema, 'params'),
  deleteUser,
);
