import { z } from 'zod';

export const updateSiteSettingsSchema = z
  .object({
    halloween_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хотя бы одну настройку',
  });

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
