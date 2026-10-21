import { z } from 'zod';

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const nameField = z
  .string({ required_error: 'Укажите название предмета' })
  .trim()
  .min(2, 'Название должно содержать минимум 2 символа')
  .max(120, 'Название слишком длинное');

const priceField = z.coerce
  .number({ invalid_type_error: 'Цена должна быть числом' })
  .finite('Цена должна быть числом')
  .positive('Цена должна быть больше нуля')
  .max(1_000_000_000_000_000_000_000, 'Слишком большая цена')
  .transform(roundMoney);

const imageUrlField = z
  .string()
  .trim()
  .max(2048, 'Слишком длинная ссылка')
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value),
    'Укажите ссылку http(s):// или путь, начинающийся с /',
  );

const categoryIdField = z
  .string()
  .uuid('Некорректный идентификатор категории')
  .nullable();

/**
 * HEX-цвет названия (#RRGGBB) или null. Сам формат проверяет сервис:
 * для него нужен ответ 400, а общая Zod-валидация отдаёт 422.
 */
const nameColorField = z.string().nullable();

export const createResourceSchema = z
  .object({
    name: nameField,
    name_color: nameColorField.optional().default(null),
    min_price: priceField,
    image_url: imageUrlField.default(''),
    category_id: categoryIdField.optional().default(null),
  })
  .strict();

export const updateResourceSchema = z
  .object({
    name: nameField.optional(),
    name_color: nameColorField.optional(),
    min_price: priceField.optional(),
    image_url: imageUrlField.optional(),
    category_id: categoryIdField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Передайте хотя бы одно поле для изменения',
  });

export const listResourcesQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional().default(''),
    category_id: z.string().uuid('Некорректный идентификатор категории').optional(),
    sort: z.enum(['name_asc', 'price_asc', 'price_desc', 'newest']).optional().default('name_asc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(1000),
  })
  .strict();
