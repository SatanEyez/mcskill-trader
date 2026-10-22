import { z } from 'zod';

export const listAuditQuerySchema = z
  .object({
    group: z
      .enum([
        'resources',
        'categories',
        'users',
        'access',
        'import',
        'support',
        'news',
        'settings',
        'auth',
      ])
      .optional(),
    period: z.enum(['24h', '7d', '30d', 'all']).optional().default('all'),
    user_id: z.string().uuid('Некорректный идентификатор администратора').optional(),
    search: z.string().trim().max(80, 'Слишком длинный поисковый запрос').optional().default(''),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export type ListAuditInput = z.infer<typeof listAuditQuerySchema>;
