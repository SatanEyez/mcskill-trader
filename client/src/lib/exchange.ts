import type { Resource } from '../types';
import { EQUALITY_TOLERANCE_SHARE } from './trade-rules';

/**
 * «Обменник»: пользователь называет предмет и количество, которые отдаёт,
 * а сайт показывает варианты встречного предложения — один предмет и
 * количество от 1 до 64 штук, равноценные по минималкам с допуском 10%
 * (п. 9.10).
 *
 * Один вариант — это одна позиция, как слот в трейде, а не набор из десяти
 * разных предметов. За раз показываем 10 вариантов; «Другой вариант» листает
 * следующие 10.
 */

/** Сколько вариантов показываем за раз. */
export const EXCHANGE_OPTIONS_PER_PAGE = 10;
/** Сколько штук одного предмета можно отдать — один стак. */
export const MAX_GIVE_QUANTITY = 64;
export const MIN_GIVE_QUANTITY = 1;
/** Количество встречного предмета — от 1 до одного стака. */
export const MAX_EXCHANGE_QUANTITY = 64;
export const EXCHANGE_STORAGE_KEY = 'mcskill.exchange.v1';

export interface ExchangeItem {
  resource: Resource;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ExchangePlan {
  /** В варианте всегда одна позиция, но форма общая с трейд-калькулятором. */
  items: ExchangeItem[];
  /** Стоимость варианта по минималкам. */
  total: number;
  /** Всего штук в варианте. */
  totalQuantity: number;
  /** «Получаю» минус «отдаю». */
  delta: number;
  /** Допустимая разница в монетах: 10% от меньшей стороны. */
  tolerance: number;
  /** Модуль разницы в процентах от меньшей стороны. */
  gapPercent: number;
  /** Разница со знаком: минус — получаю меньше, чем отдаю. */
  signedGapPercent: number;
  /** Вариант укладывается в допуск 10%. */
  ok: boolean;
}

export interface ExchangeResult {
  /** Варианты текущей страницы (до 10 штук), лучший — первым. */
  options: ExchangePlan[];
  /** Сколько всего вариантов нашлось. */
  total: number;
  /** Сколько из них уложились в допуск 10%. */
  validTotal: number;
  /** Номер страницы, с нуля. */
  page: number;
  /** Всего страниц. */
  pages: number;
}

export interface ExchangeOptions {
  /** Предмет со стороны «отдаю»: в вариантах он не участвует. */
  excludeId?: string;
  /** Номер страницы вариантов — по нему листается «Другой вариант». */
  page?: number;
  /** Сколько вариантов на странице. */
  pageSize?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Разница сторон и допуск. Повторяет `equalityTolerance` из `trade-rules`:
 * 10% от меньшей стороны, а не от суммы.
 */
export function exchangeGap(
  given: number,
  received: number,
): {
  delta: number;
  tolerance: number;
  gapPercent: number;
  signedGapPercent: number;
  ok: boolean;
} {
  const delta = round2(received - given);
  const smaller = Math.min(given, received);
  const base = smaller > 0 ? smaller : Math.max(given, received);
  const tolerance = round2(base * EQUALITY_TOLERANCE_SHARE);
  const signedGapPercent = base > 0 ? (delta / base) * 100 : 0;
  const gapPercent = Math.abs(signedGapPercent);

  // Полкопейки форы: иначе 10,000000001% показывались бы как нарушение.
  return {
    delta,
    tolerance,
    gapPercent,
    signedGapPercent,
    ok: Math.abs(delta) <= tolerance + 0.005,
  };
}

function evaluatePlan(given: number, items: ExchangeItem[]): ExchangePlan {
  const total = round2(items.reduce((sum, item) => sum + item.total, 0));

  return {
    items,
    total,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    ...exchangeGap(given, total),
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Подбирает количество встречного предмета, при котором сумма ближе всего
 * к цели. Количество всегда в диапазоне 1–64; если идеал выходит за границы,
 * берётся ближайшая граница (например, 64 для дешёвого предмета).
 */
function bestQuantity(
  target: number,
  price: number,
): { quantity: number; total: number; distance: number } | null {
  const ideal = target / price;
  const candidates = new Set<number>();

  for (const raw of [Math.floor(ideal), Math.round(ideal), Math.ceil(ideal)]) {
    if (!Number.isFinite(raw)) continue;

    candidates.add(Math.min(MAX_EXCHANGE_QUANTITY, Math.max(1, raw)));
  }

  let best: { quantity: number; total: number; distance: number } | null = null;

  for (const quantity of candidates) {
    const total = round2(price * quantity);
    const distance = Math.abs(target - total);

    if (!best || distance < best.distance) best = { quantity, total, distance };
  }

  return best;
}

/** Группы по количеству: варианты в выдаче не должны быть все по 1 штуке. */
function quantityBucket(quantity: number): number {
  if (quantity <= 1) return 0;
  if (quantity <= 3) return 1;
  if (quantity <= 7) return 2;
  if (quantity <= 15) return 3;
  if (quantity <= 31) return 4;
  if (quantity <= 63) return 5;

  return 6;
}

/**
 * Чередует варианты из групп по количеству. Так на одной странице рядом
 * оказываются и «1 × дорогой», и «8 × средний», и «64 × дешёвый» — иначе
 * первые десять строк были бы забиты одинаковыми количествами.
 */
function interleaveByQuantity(plans: ExchangePlan[]): ExchangePlan[] {
  const buckets = new Map<number, ExchangePlan[]>();

  for (const plan of plans) {
    const key = quantityBucket(plan.items[0]?.quantity ?? 1);
    const list = buckets.get(key);

    if (list) list.push(plan);
    else buckets.set(key, [plan]);
  }

  const lists = [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, list]) => list);
  const longest = lists.reduce((max, list) => Math.max(max, list.length), 0);
  const ordered: ExchangePlan[] = [];

  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      const plan = list[index];
      if (plan) ordered.push(plan);
    }
  }

  return ordered;
}

function comparePlans(left: ExchangePlan, right: ExchangePlan): number {
  if (left.gapPercent !== right.gapPercent) return left.gapPercent - right.gapPercent;

  const leftItem = left.items[0];
  const rightItem = right.items[0];
  const byQuantity = (rightItem?.quantity ?? 0) - (leftItem?.quantity ?? 0);
  if (byQuantity !== 0) return byQuantity;

  return (leftItem?.resource.name ?? '').localeCompare(rightItem?.resource.name ?? '', 'ru');
}

/**
 * Собирает по одному лучшему варианту на каждый предмет. Одинаковые названия
 * (в прайсе есть дубли) схлопываются — иначе список из 10 карточек выглядел бы
 * как один и тот же предмет, повторённый несколько раз.
 */
function buildOptions(
  target: number,
  resources: Resource[],
  excludeId?: string,
): ExchangePlan[] {
  const excluded = excludeId
    ? (resources.find((resource) => resource.id === excludeId) ?? null)
    : null;
  const excludedName = excluded ? normalizeName(excluded.name) : null;
  const byName = new Map<string, ExchangePlan>();

  for (const resource of resources) {
    if (resource.id === excludeId) continue;

    const nameKey = normalizeName(resource.name);
    if (excludedName && nameKey === excludedName) continue;

    const price = round2(Number(resource.min_price));
    if (!(price > 0)) continue;

    const match = bestQuantity(target, price);
    if (!match) continue;

    const plan = evaluatePlan(target, [
      {
        resource,
        quantity: match.quantity,
        unitPrice: price,
        total: match.total,
      },
    ]);
    const previous = byName.get(nameKey);

    if (!previous || plan.gapPercent < previous.gapPercent) {
      byName.set(nameKey, plan);
    }
  }

  return [...byName.values()];
}

/**
 * Подбирает варианты встречного предложения под сумму `given`.
 *
 * Каждый вариант — один предмет и количество 1–64. Сначала берутся варианты
 * в допуске 10%, отсортированные по точности и перемешанные по количеству,
 * затем страница разрезается по 10 штук. Если в допуск не уложился ни один,
 * возвращаются самые близкие — с честной пометкой «вне допуска».
 *
 * `null` — подбирать не из чего (нет предметов с ценой или сумма нулевая).
 */
export function assembleExchange(
  given: number,
  resources: Resource[],
  options: ExchangeOptions = {},
): ExchangeResult | null {
  const goal = round2(given);
  if (!(goal > 0)) return null;

  const plans = buildOptions(goal, resources, options.excludeId);
  if (plans.length === 0) return null;

  const valid = plans.filter((plan) => plan.ok).sort(comparePlans);
  const invalid = plans.filter((plan) => !plan.ok).sort(comparePlans);
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? EXCHANGE_OPTIONS_PER_PAGE));
  // Если есть варианты в допуске — показываем только их. Если нет, показываем
  // один десяток самых близких: листать тысячи заведомо неравноценных сделок
  // бессмысленно, а честная пометка всё равно остаётся.
  const ordered =
    valid.length > 0
      ? interleaveByQuantity(valid)
      : invalid.slice(0, pageSize);

  const total = ordered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rawPage = Math.trunc(options.page ?? 0);
  const page = ((rawPage % pages) + pages) % pages;

  const pageOptions = ordered
    .slice(page * pageSize, page * pageSize + pageSize)
    .sort(comparePlans);

  return {
    options: pageOptions,
    total,
    validTotal: valid.length,
    page,
    pages,
  };
}

export interface ExchangeState {
  resourceId: string | null;
  quantity: number;
  /** Категория, по которой отфильтрованы варианты; `null` — все. */
  categoryId: string | null;
}

export function clampGiveQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_GIVE_QUANTITY;

  return Math.min(MAX_GIVE_QUANTITY, Math.max(MIN_GIVE_QUANTITY, Math.trunc(value)));
}

/** Сохранённый выбор: чтобы обновление страницы не сбрасывало предмет. */
export function loadExchangeState(): ExchangeState | null {
  try {
    const raw = localStorage.getItem(EXCHANGE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      resourceId?: unknown;
      quantity?: unknown;
      categoryId?: unknown;
    } | null;
    if (typeof parsed !== 'object' || parsed === null) return null;

    const resourceId = typeof parsed.resourceId === 'string' ? parsed.resourceId : null;
    const quantity =
      typeof parsed.quantity === 'number' && Number.isFinite(parsed.quantity)
        ? clampGiveQuantity(parsed.quantity)
        : MIN_GIVE_QUANTITY;
    // Старые сохранения без фильтра читаются как «все категории».
    const categoryId = typeof parsed.categoryId === 'string' ? parsed.categoryId : null;

    return { resourceId, quantity, categoryId };
  } catch {
    return null;
  }
}

export function saveExchangeState(state: ExchangeState): void {
  try {
    localStorage.setItem(EXCHANGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Приватный режим или переполнение хранилища — просто не сохраняем.
  }
}
