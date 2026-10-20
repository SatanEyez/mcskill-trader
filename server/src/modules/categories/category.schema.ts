import { z } from 'zod';

export const categoryNameField = z
  .string({ required_error: 'Укажите название категории' })
  .trim()
  .min(2, 'Название категории должно содержать минимум 2 символа')
  .max(60, 'Название категории слишком длинное');

export const createCategorySchema = z
  .object({
    name: categoryNameField,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryNameField,
  })
  .strict();

export const categoryIdParamSchema = z
  .object({
    id: z.string().uuid('Некорректный идентификатор категории'),
  })
  .strict();
