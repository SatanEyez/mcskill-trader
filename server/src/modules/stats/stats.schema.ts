import { z } from 'zod';

export const VISIT_PERIODS = ['24h', '7d', '30d', 'all'] as const;

export const trackVisitSchema = z
  .object({
    path: z.string().trim().max(255).optional().default('/'),
    referrer: z.string().trim().max(255).optional().default(''),
  })
  .strict();

export const visitStatsQuerySchema = z
  .object({
    period: z.enum(VISIT_PERIODS).optional().default('7d'),
  })
  .strict();

export const visitorsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export type TrackVisitInput = z.infer<typeof trackVisitSchema>;
export type VisitStatsQuery = z.infer<typeof visitStatsQuerySchema>;
export type VisitorsQuery = z.infer<typeof visitorsQuerySchema>;
