import { getDb } from '../../db/index.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import { SITE_THEMES } from './settings.schema.js';
import type { UpdateSiteSettingsInput } from './settings.schema.js';
import type {
  SiteSettingRow,
  SiteSettingsDto,
  SiteSettingsUpdateResult,
  SiteTheme,
} from './settings.types.js';

/** Тема по умолчанию: обычное оформление без сезонных эффектов. */
const DEFAULT_THEME: SiteTheme = 'default';

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

function isSiteTheme(value: unknown): value is SiteTheme {
  return typeof value === 'string' && (SITE_THEMES as readonly string[]).includes(value);
}

/**
 * Определяет активную тему.
 *
 * Сначала читаем ключ `theme`. Если его нет (база обновлена со старой версии),
 * выводим тему из прежних флагов: включённый хэллоуин важнее новогоднего,
 * потому что до появления `theme` существовал только он.
 */
function resolveTheme(values: Map<string, unknown>): SiteTheme {
  const stored = parseJson(values.get('theme'));
  const normalized = typeof stored === 'string' ? stored.trim().toLowerCase() : stored;

  if (isSiteTheme(normalized)) return normalized;
  if (readBoolean(values.get('new_year_enabled'), false)) return 'newyear';
  if (readBoolean(values.get('halloween_enabled'), false)) return 'halloween';

  return DEFAULT_THEME;
}

/**
 * Переводит входные данные в тему.
 *
 * `theme` — основной способ. Флаги нужны старым клиентам и позволяют
 * включать/выключать конкретное оформление, не зная про остальные: выключение
 * флага сбрасывает тему в обычную только если она и была этой темой.
 */
function resolveInputTheme(input: UpdateSiteSettingsInput, current: SiteTheme): SiteTheme {
  if (input.theme) return input.theme;
  if (input.halloween_enabled === true) return 'halloween';
  if (input.new_year_enabled === true) return 'newyear';
  if (input.halloween_enabled === false && current === 'halloween') return DEFAULT_THEME;
  if (input.new_year_enabled === false && current === 'newyear') return DEFAULT_THEME;

  return current;
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
  const theme = resolveTheme(values);

  return {
    theme,
    // Флаги — производные от темы: один источник истины, два удобных вида.
    halloween_enabled: theme === 'halloween',
    new_year_enabled: theme === 'newyear',
  };
}

export async function updateSiteSettings(
  input: UpdateSiteSettingsInput,
  actor: AuthPayload,
): Promise<SiteSettingsUpdateResult> {
  const previous = await getSiteSettings();
  const theme = resolveInputTheme(input, previous.theme);
  const db = await getDb();

  await db.query(
    `INSERT INTO site_settings (setting_key, setting_value, updated_by_login)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       updated_by_login = VALUES(updated_by_login),
       updated_at = CURRENT_TIMESTAMP(3)`,
    ['theme', JSON.stringify(theme), actor.login],
  );

  const data = await getSiteSettings();

  // Защита от опечатки в имени ключа: наружу должен уйти известный набор полей.
  if (!isSiteTheme(data.theme)) {
    throw new HttpError(500, 'Не удалось сохранить настройки сайта');
  }

  return { data, previous };
}
