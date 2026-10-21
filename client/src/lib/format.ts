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

/** Разбивает строку на отдельные слова (дефисы и пробелы — разделители). */
function words(value: string): string[] {
  return value.toLowerCase().split(/[-\s]+/).filter((w) => w.length > 0);
}

/** Длина общего начала двух строк. */
function commonPrefix(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

/**
 * Насколько слово запроса совпадает со словом названия. 0 — не совпало.
 *
 * Сравнение идёт по началу слов, а не по вхождению подстроки: раньше
 * «компостер» находил «Банку с жёлтым сердцем» — слово «с» считалось
 * вхождением в запрос, а «стена» совпадала по корню «сте».
 */
function wordScore(queryWord: string, targetWord: string): number {
  if (queryWord === targetWord) return 3;

  // «алмаз» → «Алмазный блок», «метаматерия» → «Мета-материя».
  // Слова короче трёх букв («с», «к», «не») совпадать по началу не должны:
  // иначе «компостер» цепляет «Приправу к салату».
  if (targetWord.length >= 3 && targetWord.startsWith(queryWord)) return 2;
  if (targetWord.length >= 3 && queryWord.length >= 3 && queryWord.startsWith(targetWord)) return 2;

  // Кусок составного слова: «материя» → «метаматерия»
  if (queryWord.length >= 4 && targetWord.includes(queryWord)) return 2;

  // Русские окончания: «кровавое» ↔ «кровавой», «тёмное» ↔ «тёмной»
  const prefix = commonPrefix(queryWord, targetWord);
  const shortest = Math.min(queryWord.length, targetWord.length);
  if (prefix >= 4 && prefix >= shortest - 2) return 1;

  return 0;
}

/**
 * Релевантность названия запросу. 0 — не подходит.
 *
 * Чем больше число, тем выше предмет в списке: точное совпадение названия
 * всегда первое, дальше — названия, начинающиеся с запроса, потом слова
 * в любом порядке и совпадения по корню.
 *
 * Примеры:
 *   «компостер»            → «Компостер» первым, мусорных совпадений нет
 *   «материя мета»         → «Мета-материя»
 *   «тёмное кровавое ядро» → «Тёмное ядро кровавой луны»
 *   «ядро тёмное»          → «Тёмное ядро кровавой луны»
 */
export function searchScore(query: string, target: string): number {
  const queryWords = words(query);
  if (queryWords.length === 0) return 0;
  if (target.length === 0) return 0;

  const targetWords = words(target);
  if (targetWords.length === 0) return 0;

  let total = 0;

  for (const queryWord of queryWords) {
    let best = 0;

    for (const targetWord of targetWords) {
      const score = wordScore(queryWord, targetWord);
      if (score > best) best = score;
      if (best === 3) break;
    }

    // Все слова запроса обязаны найтись в названии.
    if (best === 0) return 0;
    total += best;
  }

  const normalizedQuery = normalizeSearch(query);
  const normalizedTarget = normalizeSearch(target);

  if (normalizedTarget === normalizedQuery) total += 100;
  else if (normalizedTarget.startsWith(normalizedQuery)) total += 40;
  else if (normalizedTarget.includes(normalizedQuery)) total += 15;

  return total;
}
