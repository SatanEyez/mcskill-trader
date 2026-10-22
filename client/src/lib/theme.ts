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

/**
 * Параметры перекраски обычных (не «shiny») префиксов.
 *
 * У «shiny» цвет считает CSS (`html.newyear` / `html.halloween` перекрашивают
 * градиент блеска), сюда он попадает как есть. Здесь — только ровный текст,
 * и доля сезонного цвета взята большой, чтобы префикс менялся заметно: с
 * золотым #F5C542 мягкая подмешка даёт тот же жёлтый и смена темы не видна.
 */
const PREFIX_TINTS: Record<SiteTheme, { tint: [number, number, number]; share: number } | null> = {
  default: null,
  /*
   * Хэллоуин — фиолетовый, а не оранжевый: оранжевый с золотым даёт то же
   * золото. Фиолет — вторая краска праздника, а оранжевым светится свечение.
   */
  halloween: { tint: [168, 85, 247], share: 0.5 },
  // Зима — насыщенный небесно-голубой: он же стоит в градиенте блеска.
  newyear: { tint: [56, 189, 248], share: 0.5 },
};

function parseHex(color: string): [number, number, number] | null {
  const value = color.trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(value)) {
    return [
      parseInt(value[0]! + value[0], 16),
      parseInt(value[1]! + value[1], 16),
      parseInt(value[2]! + value[2], 16),
    ];
  }

  if (/^[0-9a-f]{6}$/i.test(value)) {
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  return null;
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Цвет префикса под активную тему.
 *
 * Сезонные темы подмешивают свой оттенок, но не затирают исходный цвет: у
 * фиолетового префикса перелив остаётся фиолетово-оранжевым, у зелёного —
 * зелёно-оранжевым. Тёмные цвета получают больше оттенка темы, иначе на тёмном
 * фоне они читались бы как грязно-серые.
 *
 * Не-hex значения (например, `rgb(...)` из старых данных) возвращаем как есть:
 * лучше ровный исходный цвет, чем сломанный разбор.
 */
export function themePrefixColor(color: string, theme: SiteTheme): string {
  const palette = PREFIX_TINTS[theme];
  if (!palette) return color;

  const base = parseHex(color);
  if (!base) return color;

  const share = Math.min(0.62, palette.share + (1 - luminance(base)) * 0.18);
  const mixed: [number, number, number] = [
    base[0] + (palette.tint[0] - base[0]) * share,
    base[1] + (palette.tint[1] - base[1]) * share,
    base[2] + (palette.tint[2] - base[2]) * share,
  ];

  return toHex(mixed);
}
