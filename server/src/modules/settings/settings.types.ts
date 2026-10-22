import type { SITE_THEMES } from './settings.schema.js';

export type SiteTheme = (typeof SITE_THEMES)[number];

/**
 * Публичные настройки оформления сайта.
 *
 * `theme` — источник истины; два флага оставлены для совместимости со старыми
 * сборками клиента, которые ещё читают `halloween_enabled`.
 */
export interface SiteSettingsDto {
  theme: SiteTheme;
  halloween_enabled: boolean;
  new_year_enabled: boolean;
}

export interface SiteSettingRow {
  setting_key: string;
  setting_value: unknown;
  updated_by_login: string | null;
  updated_at: Date | string;
}

export interface SiteSettingsUpdateResult {
  data: SiteSettingsDto;
  previous: SiteSettingsDto;
}
