const priceFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return priceFormatter.format(value);
}

/** Количество знаков в целой части — для выбора размера шрифта длинных сумм. */
export function amountDigitCount(value: number): number {
  if (!Number.isFinite(value)) return 1;

  const abs = Math.abs(value);
  if (abs < 1) return 1;

  return Math.floor(Math.log10(abs)) + 1;
}

/** Цена с точками между разрядами: 44.606,4 — так проще считать разряды. */
export function formatPriceDots(value: number): string {
  return formatPrice(value).replace(/[\u00A0\u202F\s]/g, '.');
}

/** Количество с точками между разрядами: 1.000.000.000.000.000.000. */
export function formatQuantityDots(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return amountFormatter.format(value).replace(/[\u00A0\u202F\s]/g, '.');
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000) return compactFormatter.format(value);
  return amountFormatter.format(value);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function formatQuantityLabel(count: number): string {
  if (!Number.isFinite(count)) return '—';

  // Показываем полное количество: в трейд-калькуляторе оно вынесено на отдельную
  // строку и может переноситься, поэтому компактная запись «1 000 000 трлн» только путает.
  const text = formatQuantityDots(count);

  return `${text} ${pluralize(count, ['штука', 'штуки', 'штук'])}`;
}

/** Московское время: в журнале и списке администраторов время показываем по МСК. */
export const MSK_TIME_ZONE = 'Europe/Moscow';

const mskDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: MSK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const mskDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: MSK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const mskTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: MSK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function parse(isoDate: string | null | undefined): Date | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateMsk(isoDate: string | null | undefined): string {
  const date = parse(isoDate);
  return date ? mskDateFormatter.format(date) : '—';
}

export function formatTimeMsk(isoDate: string | null | undefined): string {
  const date = parse(isoDate);
  return date ? mskTimeFormatter.format(date) : '—';
}

/** «2 ч 15 мин», «18 мин», «меньше минуты». Для времени в сети. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || (seconds ?? 0) <= 0) return '—';

  const total = Math.floor(seconds as number);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`;
  if (hours > 0) return `${hours} ч`;
  if (minutes > 0) return `${minutes} мин`;

  return 'меньше минуты';
}

/** «20.10.2026, 02:41:12 МСК». */
export function formatDateTimeMsk(isoDate: string | null | undefined): string {
  const date = parse(isoDate);
  return date ? `${mskDateTimeFormatter.format(date)} МСК` : '—';
}

/**
 * Нормализует строку для «мягкого» поиска: убирает дефисы, пробелы и
 * приводит к нижнему регистру. «мета-материя» и «мета материя» → «метаматерия».
 */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[-\s]/g, '');
}
