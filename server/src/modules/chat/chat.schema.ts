import { z } from 'zod';

export const createRoomSchema = z
  .object({
    name: z
      .string({ required_error: 'Укажите название комнаты' })
      .trim()
      .min(2, 'Название должно содержать минимум 2 символа')
      .max(60, 'Название комнаты слишком длинное'),
    /** Минимальный уровень доступа, который видит комнату (0 — все с правом chat.use). */
    access_level: z.coerce
      .number({ invalid_type_error: 'Уровень доступа должен быть числом' })
      .int('Уровень доступа должен быть целым')
      .min(0, 'Уровень доступа не может быть отрицательным')
      .max(1000, 'Слишком большой уровень доступа')
      .optional()
      .default(0),
    /** С какого уровня доступа в комнате видны префиксы (0 — всем участникам). */
    prefix_level: z.coerce
      .number({ invalid_type_error: 'Порог префиксов должен быть числом' })
      .int('Порог префиксов должен быть целым')
      .min(0, 'Порог префиксов не может быть отрицательным')
      .max(1000, 'Слишком большой порог префиксов')
      .optional()
      .default(0),
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
