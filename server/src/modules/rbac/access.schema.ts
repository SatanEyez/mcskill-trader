import { z } from 'zod';
import { PERMISSION_KEYS } from './permissions.js';

const permissionField = z
  .array(z.string())
  .max(PERMISSION_KEYS.length + 1, 'Слишком много прав')
  .transform((values) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))))
  .refine(
    (values) => values.every((value) => value === '*' || PERMISSION_KEYS.includes(value as never)),
    'Неизвестное право доступа',
  );

const roleCodeField = z
  .string()
  .trim()
  .min(2, 'Код роли слишком короткий')
  .max(40, 'Код роли слишком длинный')
  .regex(/^[a-z][a-z0-9_-]*$/, 'Код: латиница в нижнем регистре, цифры, _ и -');

const roleNameField = z
  .string()
  .trim()
  .min(2, 'Название роли слишком короткое')
  .max(60, 'Название роли слишком длинное');

const roleDescriptionField = z.string().trim().max(500, 'Слишком длинное описание').nullable();

export const createRoleSchema = z
  .object({
    code: roleCodeField,
    name: roleNameField,
    description: roleDescriptionField.optional().default(null),
    permissions: permissionField,
  })
  .strict();

export const updateRoleSchema = z
  .object({
    name: roleNameField.optional(),
    description: roleDescriptionField.optional(),
    permissions: permissionField.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хотя бы одно поле',
  });

export const roleIdParamSchema = z
  .object({ id: z.string().uuid('Некорректный идентификатор роли') })
  .strict();

const prefixNameField = z
  .string()
  .trim()
  .min(2, 'Название префикса слишком короткое')
  .max(40, 'Название префикса слишком длинное');

const prefixColorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB')
  .transform((value) => value.toUpperCase());

export const createPrefixSchema = z
  .object({
    name: prefixNameField,
    color: prefixColorField,
    priority: z.coerce.number().int().min(-100).max(100).optional().default(0),
  })
  .strict();

export const updatePrefixSchema = z
  .object({
    name: prefixNameField.optional(),
    color: prefixColorField.optional(),
    priority: z.coerce.number().int().min(-100).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хотя бы одно поле',
  });

export const prefixIdParamSchema = z
  .object({ id: z.string().uuid('Некорректный идентификатор префикса') })
  .strict();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreatePrefixInput = z.infer<typeof createPrefixSchema>;
export type UpdatePrefixInput = z.infer<typeof updatePrefixSchema>;
