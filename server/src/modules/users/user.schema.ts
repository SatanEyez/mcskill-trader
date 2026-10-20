import { z } from 'zod';

export const listUsersQuerySchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  })
  .strict();

export const userIdParamSchema = z
  .object({
    id: z.string().uuid('Некорректный идентификатор администратора'),
  })
  .strict();

export const updateUserRoleSchema = z
  .object({
    role: z.enum(['owner', 'admin']),
  })
  .strict();

export const updateUserAccessSchema = z
  .object({
    role_id: z.string().uuid('Некорректная роль').nullable(),
    prefix_id: z.string().uuid('Некорректный префикс').nullable(),
  })
  .strict();

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;
