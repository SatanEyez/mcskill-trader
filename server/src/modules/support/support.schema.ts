import { z } from 'zod';

export const TICKET_KINDS = ['item', 'price', 'error', 'other'] as const;
export const TICKET_STATUSES = ['new', 'in_progress', 'answered', 'closed'] as const;

export const createReportSchema = z
  .object({
    kind: z.enum(TICKET_KINDS, {
      errorMap: () => ({ message: 'Выберите тип обращения' }),
    }),
    nick: z
      .string({ required_error: 'Укажите игровой ник' })
      .trim()
      .min(2, 'Ник слишком короткий')
      .max(64, 'Ник слишком длинный'),
    discord: z
      .string({ required_error: 'Укажите Discord' })
      .trim()
      .min(2, 'Укажите Discord для связи')
      .max(64, 'Слишком длинный Discord'),
    target: z.string().trim().max(160, 'Слишком длинное описание предмета').optional().default(''),
    message: z
      .string({ required_error: 'Опишите проблему' })
      .trim()
      .min(10, 'Опишите проблему подробнее (минимум 10 символов)')
      .max(4000, 'Слишком длинное сообщение'),
  })
  .strict();

export const listTicketsQuerySchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    kind: z.enum(TICKET_KINDS).optional(),
    search: z.string().trim().max(100).optional().default(''),
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const ticketIdParamSchema = z
  .object({ id: z.string().uuid('Некорректный идентификатор обращения') })
  .strict();

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    admin_reply: z.string().trim().max(4000, 'Слишком длинный ответ').optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте статус или ответ',
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
