interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Светлый оттенок темы, к которому подмешиваем слишком тёмные цвета. */
const LIGHT_TARGET: Rgb = { r: 0xe2, g: 0xe8, b: 0xf0 };

/**
 * Минимальная относительная яркость текста на тёмной теме (#0a1118).
 * При ней контраст с фоном выше 4.5:1, поэтому название читается.
 */
const MIN_READABLE_LUMINANCE = 0.3;

function parseHex(value: string): Rgb | null {
  if (!HEX_COLOR_PATTERN.test(value)) return null;

  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

/** sRGB-канал → линейная яркость по формуле WCAG. */
function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function mix(from: Rgb, to: Rgb, ratio: number): Rgb {
  return {
    r: Math.round(from.r + (to.r - from.r) * ratio),
    g: Math.round(from.g + (to.g - from.g) * ratio),
    b: Math.round(from.b + (to.b - from.b) * ratio),
  };
}

function toCss({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Цвет названия предмета из Minecraft-кода (#RRGGBB).
 * Тёмные цвета (#000000, #555555 и подобные) на тёмной теме не читаются,
 * поэтому их плавно подмешиваем к светлому #e2e8f0 до приемлемой яркости.
 * null/некорректное значение → undefined: название остаётся цвета темы.
 */
export function readableNameColor(nameColor: string | null | undefined): string | undefined {
  if (!nameColor) return undefined;

  const rgb = parseHex(nameColor);
  if (!rgb) return undefined;

  if (relativeLuminance(rgb) >= MIN_READABLE_LUMINANCE) return nameColor;

  // Бинарный поиск минимальной доли подмешивания, при которой текст читается.
  let low = 0;
  let high = 1;

  for (let step = 0; step < 12; step += 1) {
    const middle = (low + high) / 2;
    if (relativeLuminance(mix(rgb, LIGHT_TARGET, middle)) < MIN_READABLE_LUMINANCE) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return toCss(mix(rgb, LIGHT_TARGET, high));
}
