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
      .string({ required_error: 'Введите сообщение' })
      .trim()
      .min(1, 'Сообщение не может быть пустым')
      .max(4000, 'Сообщение слишком длинное'),
  })
  .strict();

export const listMessagesQuerySchema = z
  .object({
    before: z.string().datetime({ message: 'Некорректное время сообщения' }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
