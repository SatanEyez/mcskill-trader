import { z } from 'zod';

export const createRoomSchema = z
  .object({
    name: z
      .string({ required_error: 'Укажите название комнаты' })
      .trim()
      .min(2, 'Название должно содержать минимум 2 символа')
      .max(60, 'Название комнаты слишком длинное'),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    message: z
      .string({ invalid_type_error: 'Сообщение должно быть текстом' })
      .trim()
      .max(4000, 'Сообщение слишком длинное')
      .optional()
      .default(''),
    image_url: z
      .string()
      .trim()
      .max(512, 'Слишком длинная ссылка на изображение')
      .refine(
        (value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value),
        'Ссылка на изображение должна начинаться с / или http(s)://',
      )
      .optional()
      .nullable(),
  })
  .strict()
  .refine((data) => data.message.length > 0 || Boolean(data.image_url), {
    message: 'Введите сообщение или прикрепите фото',
    path: ['message'],
  });

export const listMessagesQuerySchema = z
  .object({
    before: z.string().datetime({ message: 'Некорректное время сообщения' }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
