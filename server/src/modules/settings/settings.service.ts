import { getDb } from '../../db/index.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import type { UpdateSiteSettingsInput } from './settings.schema.js';
import type {
  SiteSettingRow,
  SiteSettingsDto,
  SiteSettingsUpdateResult,
} from './settings.types.js';

/** Значения по умолчанию, если строка в БД ещё не создана. */
const DEFAULT_SETTINGS: SiteSettingsDto = {
  halloween_enabled: true,
};

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  const parsed = parseJson(value);

  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'number') return parsed !== 0;
  if (typeof parsed === 'string') {
    const normalized = parsed.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  return fallback;
}

/** Читает публичные настройки. Неизвестные ключи наружу не отдаём. */
export async function getSiteSettings(): Promise<SiteSettingsDto> {
  const db = await getDb();
  const result = await db.query<SiteSettingRow>(
    'SELECT setting_key, setting_value, updated_by_login, updated_at FROM site_settings',
  );

  const values = new Map(
    result.rows.map((row) => [row.setting_key, row.setting_value] as const),
  );

  return {
    halloween_enabled: readBoolean(
      values.get('halloween_enabled'),
      DEFAULT_SETTINGS.halloween_enabled,
    ),
  };
}

export async function updateSiteSettings(
  input: UpdateSiteSettingsInput,
  actor: AuthPayload,
): Promise<SiteSettingsUpdateResult> {
  const previous = await getSiteSettings();
  const db = await getDb();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    await db.query(
      `INSERT INTO site_settings (setting_key, setting_value, updated_by_login)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         updated_by_login = VALUES(updated_by_login),
         updated_at = CURRENT_TIMESTAMP(3)`,
      [key, JSON.stringify(value), actor.login],
    );
  }

  const data = await getSiteSettings();

  // Защита от опечатки в имени ключа: наружу должен уйти известный набор полей.
  if (!data || typeof data.halloween_enabled !== 'boolean') {
    throw new HttpError(500, 'Не удалось сохранить настройки сайта');
  }

  return { data, previous };
}
