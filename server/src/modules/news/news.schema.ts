import { z } from 'zod';

/** Внешняя ссылка или локальный путь вида `/uploads/...`. */
const imageUrl = z
  .string()
  .trim()
  .max(512, 'Слишком длинная ссылка на изображение')
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value),
    'Ссылка должна начинаться с http(s):// или /',
  );

export const createNewsSchema = z
  .object({
    title: z
      .string({ required_error: 'Укажите заголовок' })
      .trim()
      .min(3, 'Заголовок слишком короткий')
      .max(160, 'Заголовок слишком длинный'),
    body: z
      .string({ required_error: 'Напишите текст новости' })
      .trim()
      .min(10, 'Текст слишком короткий (минимум 10 символов)')
      .max(20_000, 'Текст слишком длинный'),
    image_url: imageUrl.optional().default(''),
    is_published: z.boolean().optional().default(true),
  })
  .strict();

export const updateNewsSchema = z
  .object({
    title: z.string().trim().min(3, 'Заголовок слишком короткий').max(160, 'Заголовок слишком длинный').optional(),
    body: z.string().trim().min(10, 'Текст слишком короткий').max(20_000, 'Текст слишком длинный').optional(),
    image_url: imageUrl.optional(),
    is_published: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хотя бы одно поле',
  });

export const newsIdParamSchema = z
  .object({ id: z.string().uuid('Некорректный идентификатор новости') })
  .strict();

export const listNewsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;
export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
