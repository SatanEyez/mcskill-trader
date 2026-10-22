import { z } from 'zod';

/** Темы оформления сайта. Активна ровно одна. */
export const SITE_THEMES = ['default', 'halloween', 'newyear'] as const;

export const updateSiteSettingsSchema = z
  .object({
    /** Основной способ: выбрать тему целиком. */
    theme: z.enum(SITE_THEMES).optional(),
    /**
     * Совместимость со старым клиентом: `true` — хэллоуин, `false` — обычная
     * тема. Если пришёл и `theme`, и флаг, приоритет у `theme`.
     */
    halloween_enabled: z.boolean().optional(),
    /** Удобный флаг для нового клиента: включить новогоднее оформление. */
    new_year_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хотя бы одну настройку',
  });

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
