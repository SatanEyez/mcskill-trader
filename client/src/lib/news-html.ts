/**
 * Новости хранят текст в `body`: либо простой текст, либо HTML из редактора.
 * Здесь — распознавание и безопасная очистка разметки перед вставкой на страницу.
 */

/** Теги, которые редактор новостей может оставить в тексте. */
const ALLOWED_TAGS = new Set([
  'P',
  'DIV',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'SPAN',
  'UL',
  'OL',
  'LI',
  'H3',
  'H4',
  'BLOCKQUOTE',
]);

/** Теги, которые удаляются вместе с содержимым. */
const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);

/** Разрешённые CSS-свойства внутри `style`. */
const ALLOWED_STYLES = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
]);

/** Похоже ли значение на HTML из редактора. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Простой текст → HTML для редактора: переносы строк становятся `<br>`. */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** Текст без разметки — для анонсов и проверки длины. */
export function stripHtml(value: string): string {
  if (!looksLikeHtml(value)) return value;

  const doc = new DOMParser().parseFromString(value, 'text/html');

  return doc.body.textContent ?? '';
}

function filterStyle(style: string): string {
  const safe: string[] = [];

  for (const chunk of style.split(';')) {
    const separator = chunk.indexOf(':');
    if (separator === -1) continue;

    const name = chunk.slice(0, separator).trim().toLowerCase();
    const value = chunk.slice(separator + 1).trim();

    if (!ALLOWED_STYLES.has(name) || value.length === 0) continue;
    // Никаких expression(), url() и javascript: внутри стилей.
    if (/expression|javascript:|url\(|@import/i.test(value)) continue;

    safe.push(`${name}: ${value}`);
  }

  return safe.join('; ');
}

/**
 * Очищает HTML новости: оставляет только разрешённые теги и свойства стиля.
 * Скрипты и вставки удаляются целиком, чужие теги разворачиваются в текст.
 */
export function sanitizeNewsHtml(value: string): string {
  if (!looksLikeHtml(value)) return plainTextToHtml(value);

  const doc = new DOMParser().parseFromString(value, 'text/html');

  for (const element of Array.from(doc.body.querySelectorAll('*'))) {
    if (BLOCKED_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(element.tagName)) {
      // Неизвестный тег разворачиваем: содержимое остаётся, обёртка исчезает.
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name !== 'style') element.removeAttribute(attribute.name);
    }

    const style = element.getAttribute('style');
    if (style === null) continue;

    const safeStyle = filterStyle(style);
    if (safeStyle) element.setAttribute('style', safeStyle);
    else element.removeAttribute('style');
  }

  return doc.body.innerHTML.trim();
}
