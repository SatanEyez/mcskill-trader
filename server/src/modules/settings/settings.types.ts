/** Публичные настройки оформления сайта. */
export interface SiteSettingsDto {
  halloween_enabled: boolean;
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
