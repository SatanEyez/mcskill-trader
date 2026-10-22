import type { SiteTheme } from '../types';

/**
 * Тема оформления: где хранится выбор и как он влияет на цвета.
 *
 * Источник истины — API. В localStorage держим последнее известное значение,
 * чтобы сезонная тема не мигала при загрузке страницы. Ключ новый
 * (`mcskill.site.theme`), но старый флаг хэллоуина читаем как fallback:
 * у владельца в браузере могло остаться `mcskill.site.halloween`.
 */

export const THEME_STORAGE_KEY = 'mcskill.site.theme';
const LEGACY_HALLOWEEN_KEY = 'mcskill.site.halloween';

export const THEME_LABELS: Record<SiteTheme, string> = {
  default: 'Обычное',
  halloween: 'Хэллоуин',
  newyear: 'Новый год',
};

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'default' || value === 'halloween' || value === 'newyear';
}

export function readStoredTheme(): SiteTheme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isSiteTheme(stored)) return stored;

    const legacy = localStorage.getItem(LEGACY_HALLOWEEN_KEY);
    if (legacy === '1') return 'halloween';
    if (legacy === '0') return 'default';
  } catch {
    // Приватный режим может запрещать localStorage — работаем без кэша.
  }

  return null;
}

export function storeTheme(theme: SiteTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
