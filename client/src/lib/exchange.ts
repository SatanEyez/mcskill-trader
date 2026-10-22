import type { Resource } from '../types';
import { EQUALITY_TOLERANCE_SHARE } from './trade-rules';

/**
 * «Обменник»: пользователь называет предмет и количество, которые отдаёт,
 * а набор на второй стороне подбирается автоматически — по минимальным ценам,
 * чтобы суммы сторон совпали с допуском 10% (п. 9.10).
 *
 * Допуск считается от меньшей стороны — ровно как в трейд-калькуляторе,
 * иначе «обменник» и калькулятор показывали бы разный вердикт по одной сделке.
 */

/** Сколько штук одного предмета можно отдать — один стак. */
export const MAX_GIVE_QUANTITY = 64;
export const MIN_GIVE_QUANTITY = 1;
/** Сколько разных предметов может быть в подобранном наборе. */
export const MAX_EXCHANGE_LINES = 10;
/**
 * Потолок количества в строке набора — один стак. Больше 64 в одной позиции
 * просить у игрока неудобно, поэтому разнообразие набирается числом позиций.
 */
export const MAX_EXCHANGE_LINE_QUANTITY = 64;
/**
 * Страховка для очень дорогих предметов: 10 видов по 64 штуки могут не добрать
 * сумму (например, «Инфинити сундук» ×64). Тогда разрешаем количества до 640,
 * иначе сделка осталась бы вне допуска 10%.
 */
const FALLBACK_LINE_QUANTITY = 640;
export const EXCHANGE_STORAGE_KEY = 'mcskill.exchange.v1';

export interface ExchangeItem {
  resource: Resource;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ExchangePlan {
  items: ExchangeItem[];
  /** Стоимость набора по минималкам. */
  total: number;
  /** Всего штук в наборе. */
  totalQuantity: number;
  /** «Получаю» минус «отдаю». */
  delta: number;
  /** Допустимая разница в монетах: 10% от меньшей стороны. */
  tolerance: number;
  /** Модуль разницы в процентах от меньшей стороны. */
  gapPercent: number;
  /** Разница со знаком: минус — получаю меньше, чем отдаю. */
  signedGapPercent: number;
  /** Набор укладывается в допуск 10%. */
  ok: boolean;
}

export interface ExchangeResult {
  plan: ExchangePlan;
  /** Сколько разных наборов удалось собрать. */
  variants: number;
  /** Сколько из них уложились в допуск. */
  validVariants: number;
}

export interface ExchangeOptions {
  /** Предмет со стороны «отдаю»: в наборе он не нужен. */
  excludeId?: string;
  /** Номер варианта — по нему листается кнопка «Другой вариант». */
  variant?: number;
  /** Сколько случайных попыток сделать вдобавок к точному жадному подбору. */
  attempts?: number;
}

interface PricedItem {
  resource: Resource;
  price: number;
}

interface GreedyOptions {
  /** Ширина окна выбора: 1 — всегда самый дорогой подходящий предмет. */
  window: number;
  /** Иногда берём не максимум количества — иначе варианты были бы одинаковыми. */
  varyQuantity: boolean;
  /** Первый предмет выбирать «якорем» по логарифму цены, а не самым дорогим. */
  anchor: boolean;
  random: () => number;
  /** Потолок количества в строке: 64 для обычных наборов, 640 для страховки. */
  quantityCap?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Быстрый детерминированный ГПСЧ: варианты должны повторяться при перерисовке. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function sumTotal(items: ExchangeItem[]): number {
  return round2(items.reduce((sum, item) => sum + item.total, 0));
}

/**
 * Чем меньше — тем лучше.
 *
 * Порядок приоритетов: уложиться в допуск 10% → набрать как можно больше
 * разных предметов → поменьше разница → поменьше штук суммарно. Допуск —
 * требование правил, поэтому он жёстко важнее точности. Число позиций важнее
 * процента: набор из 10 видов с разницей 9% полезнее, чем набор из двух
 * позиций с разницей 0,1%, — именно разнообразия не хватало в обменнике.
 * Количество в логарифме: «480 дверей» точнее, но просить такое в игре
 * никто не станет.
 */
function planScore(items: ExchangeItem[], given: number): number {
  const total = sumTotal(items);
  const gap = exchangeGap(given, total);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const penalty = gap.ok ? 0 : 1000;
  const missingLines = Math.max(0, MAX_EXCHANGE_LINES - items.length);

  return penalty + missingLines * 40 + gap.gapPercent + Math.log10(quantity + 1) * 6;
}

/** Ключ набора — чтобы один и тот же вариант не показывался дважды. */
function signature(items: ExchangeItem[]): string {
  return items
    .map((item) => `${item.resource.id}:${item.quantity}`)
    .sort()
    .join('|');
}

/**
 * Кандидаты для подбора: только предметы с ценой, и только те, что не дороже
 * цели — предмет дороже цели нельзя взять даже по одной штуке.
 */
function buildPool(resources: Resource[], given: number, excludeId?: string): PricedItem[] {
  const ceiling = given * (1 + EQUALITY_TOLERANCE_SHARE);
  const pool: PricedItem[] = [];

  for (const resource of resources) {
    if (resource.id === excludeId) continue;

    const price = round2(resource.min_price);
    if (price <= 0 || price > ceiling) continue;

    pool.push({ resource, price });
  }

  pool.sort((a, b) => b.price - a.price || a.resource.name.localeCompare(b.resource.name, 'ru'));

  return pool;
}

/** Первый индекс с ценой не больше `value`: пул отсортирован по убыванию цены. */
function firstAffordable(pool: PricedItem[], value: number): number {
  let low = 0;
  let high = pool.length;

  while (low < high) {
    const mid = (low + high) >> 1;

    if (pool[mid].price > value) low = mid + 1;
    else high = mid;
  }

  return low;
}

/**
 * «Якорь» — первый предмет набора, выбранный не по принципу «самый дорогой»,
 * а случайно по логарифму цены. Без этого наборы всегда начинались бы с самого
 * дорогого предмета и до средних по цене дело бы не доходило.
 */
function anchorIndex(pool: PricedItem[], start: number, random: () => number): number {
  const highest = pool[start].price;
  const lowest = pool[pool.length - 1].price;

  if (!(lowest > 0) || highest <= lowest) return start;

  return firstAffordable(pool, lowest * (highest / lowest) ** random());
}

/**
 * Жадный подбор «сверху вниз»: берём самый дорогой предмет, который ещё
 * влезает в остаток, и столько штук, сколько влезает. Остаток после каждого
 * шага строго меньше цены выбранного предмета, поэтому набор сходится быстро,
 * а сумма никогда не перелетает цель.
 */
function buildGreedy(given: number, pool: PricedItem[], options: GreedyOptions): ExchangeItem[] {
  const items: ExchangeItem[] = [];
  const used = new Set<string>();
  let remaining = given;

  while (items.length < MAX_EXCHANGE_LINES && remaining > 0) {
    const start = firstAffordable(pool, remaining);
    if (start >= pool.length) break;

    let index: number;

    if (items.length === 0 && options.anchor) {
      index = anchorIndex(pool, start, options.random);
    } else {
      const width = Math.min(pool.length - start, options.window);
      // Смещение вглубь окна: степень 1.8 тянет выбор к началу, но не жёстко.
      const offset =
        width > 1 ? Math.min(width - 1, Math.floor(options.random() ** 1.8 * width)) : 0;

      index = start + offset;
    }

    while (index < pool.length && used.has(pool[index].resource.id)) index += 1;
    if (index >= pool.length) break;

    const candidate = pool[index];
    const affordable = Math.floor(remaining / candidate.price + 1e-9);
    if (affordable < 1) break;

    const maxQuantity = Math.min(affordable, options.quantityCap ?? MAX_EXCHANGE_LINE_QUANTITY);
    const quantity =
      options.varyQuantity && maxQuantity > 1 && options.random() < 0.45
        ? Math.max(1, Math.round(maxQuantity * (0.3 + 0.7 * options.random())))
        : maxQuantity;

    items.push({
      resource: candidate.resource,
      quantity,
      unitPrice: candidate.price,
      total: round2(candidate.price * quantity),
    });
    used.add(candidate.resource.id);

    remaining = round2(Math.max(0, remaining - candidate.price * quantity));
  }

  return items;
}

interface SpreadOptions {
  /** Сколько ближайших по цене предметов рассматривать для случайного выбора. */
  window: number;
  random: () => number;
}

/**
 * Раскладывает сумму на много позиций: на каждом шаге делит остаток на число
 * оставшихся слотов и берёт предмет, который целиком влезает в эту долю.
 * Так набор почти всегда получается из `MAX_EXCHANGE_LINES` разных предметов,
 * а не из одной дорогой позиции, как в жадном подборе.
 *
 * Если ни один предмет не влезает в долю (очень дорогой каталог или маленькая
 * сумма), падаем в обычный жадный режим — позиций будет меньше, зато набор
 * не останется пустым.
 */
function buildSpread(given: number, pool: PricedItem[], options: SpreadOptions): ExchangeItem[] {
  const items: ExchangeItem[] = [];
  const used = new Set<string>();
  let remaining = given;

  while (items.length < MAX_EXCHANGE_LINES && remaining > 0) {
    const slotsLeft = MAX_EXCHANGE_LINES - items.length;
    const share = remaining / slotsLeft;
    let start = firstAffordable(pool, share);
    let budget = share;

    if (start >= pool.length) {
      start = firstAffordable(pool, remaining);
      budget = remaining;
      if (start >= pool.length) break;
    }

    // Собираем неиспользованные варианты в окне рядом с верхней границей доли:
    // они дают количество от 1 до 64 и тратят долю почти целиком.
    const candidates: number[] = [];

    for (let index = start; index < pool.length; index += 1) {
      if (used.has(pool[index].resource.id)) continue;

      candidates.push(index);
      if (candidates.length >= Math.max(1, options.window)) break;
    }

    if (candidates.length === 0) break;

    const offset =
      candidates.length > 1
        ? Math.min(
            candidates.length - 1,
            Math.floor(options.random() ** 1.6 * candidates.length),
          )
        : 0;
    const candidate = pool[candidates[offset]];

    if (candidate.price > remaining) break;

    const affordable = Math.floor(remaining / candidate.price + 1e-9);
    const inShare = Math.floor(budget / candidate.price + 1e-9);
    const quantity = Math.max(
      1,
      Math.min(affordable, MAX_EXCHANGE_LINE_QUANTITY, inShare),
    );

    items.push({
      resource: candidate.resource,
      quantity,
      unitPrice: candidate.price,
      total: round2(candidate.price * quantity),
    });
    used.add(candidate.resource.id);

    remaining = round2(Math.max(0, remaining - candidate.price * quantity));
  }

  return items;
}

/**
 * Доводит набор до цели: подгоняет количество в каждой строке под остаток,
 * добирает предмет под остаток и — что важнее всего — пробует выбросить
 * позицию. Жадный подбор всегда «добивает» остаток до нуля, и без этого шага
 * набор из одной позиции с разницей 0,3% проигрывал бы набору из двух позиций
 * с разницей 0%.
 */
function refine(
  items: ExchangeItem[],
  given: number,
  pool: PricedItem[],
  quantityCap: number = MAX_EXCHANGE_LINE_QUANTITY,
): ExchangeItem[] {
  let best = items;
  let bestScore = planScore(best, given);

  for (let pass = 0; pass < 8; pass += 1) {
    let improved = false;
    const total = sumTotal(best);

    for (let index = 0; index < best.length; index += 1) {
      const line = best[index];
      const others = round2(total - line.total);
      const ideal = (given - others) / line.unitPrice;
      const candidates = new Set<number>();

      for (const raw of [Math.floor(ideal), Math.ceil(ideal)]) {
        if (!Number.isFinite(raw)) continue;

        const quantity = Math.min(quantityCap, Math.max(1, raw));
        if (quantity === line.quantity) continue;

        candidates.add(quantity);
      }

      for (const quantity of candidates) {
        const next = best.slice();
        next[index] = { ...line, quantity, total: round2(line.unitPrice * quantity) };

        const score = planScore(next, given);

        if (score < bestScore) {
          best = next;
          bestScore = score;
          improved = true;
        }
      }
    }

    if (best.length < MAX_EXCHANGE_LINES) {
      const currentTotal = sumTotal(best);
      const residual = round2(given - currentTotal);

      if (residual > 0) {
        const start = firstAffordable(pool, residual);

        if (start < pool.length && !best.some((item) => item.resource.id === pool[start].resource.id)) {
          const candidate = pool[start];
          const quantity = Math.min(
            Math.floor(residual / candidate.price + 1e-9),
            quantityCap,
          );

          if (quantity >= 1) {
            const next = [
              ...best,
              {
                resource: candidate.resource,
                quantity,
                unitPrice: candidate.price,
                total: round2(candidate.price * quantity),
              },
            ];
            const score = planScore(next, given);

            if (score < bestScore) {
              best = next;
              bestScore = score;
              improved = true;
            }
          }
        }
      }
    }

    if (best.length > 1) {
      for (let index = 0; index < best.length; index += 1) {
        const next = best.filter((_, position) => position !== index);
        const score = planScore(next, given);

        if (score < bestScore) {
          best = next;
          bestScore = score;
          improved = true;
          break;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

function evaluatePlan(given: number, items: ExchangeItem[]): ExchangePlan {
  const total = sumTotal(items);

  return {
    items,
    total,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    ...exchangeGap(given, total),
  };
}

/**
 * Подбирает набор на вторую сторону под сумму `given`.
 *
 * Сначала считаются два точных варианта — «раскладка на много позиций» и
 * классический жадный, — затем несколько десятков случайных. Варианты,
 * у которых больше разных предметов, стоят в начале списка: именно их
 * показывает кнопка «Другой вариант» по умолчанию.
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

  const pool = buildPool(resources, goal, options.excludeId);
  if (pool.length === 0) return null;

  const collected = new Map<string, ExchangeItem[]>();

  const collect = (raw: ExchangeItem[], quantityCap = MAX_EXCHANGE_LINE_QUANTITY) => {
    if (raw.length === 0) return;

    const refined = refine(raw, goal, pool, quantityCap);
    const key = signature(refined);

    if (!collected.has(key)) collected.set(key, refined);
  };

  // Точный вариант «на 10 видов» и классический жадный — как страховка,
  // если раскладка по долям не сможет уложиться в допуск.
  collect(buildSpread(goal, pool, { window: 1, random: () => 0 }));
  collect(
    buildGreedy(goal, pool, {
      window: 1,
      varyQuantity: false,
      anchor: false,
      random: () => 0,
      quantityCap: FALLBACK_LINE_QUANTITY,
    }),
    FALLBACK_LINE_QUANTITY,
  );

  const attempts = Math.max(0, options.attempts ?? 36);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = mulberry32((attempt + 1) * 0x9e3779b1);

    // Каждая третья попытка — «якорный» жадный набор (1–2 позиции),
    // остальные — раскладка по долям с разным окном выбора.
    if (attempt % 3 === 0) {
      collect(
        buildGreedy(goal, pool, {
          window: 1,
          varyQuantity: false,
          anchor: true,
          random,
          quantityCap: FALLBACK_LINE_QUANTITY,
        }),
        FALLBACK_LINE_QUANTITY,
      );
      continue;
    }

    collect(
      buildSpread(goal, pool, {
        window: attempt % 2 === 0 ? 4 : 14,
        random,
      }),
    );
  }

  const plans = [...collected.values()]
    .map((items) => evaluatePlan(goal, items))
    .sort((a, b) => planScore(a.items, goal) - planScore(b.items, goal));

  if (plans.length === 0) return null;

  const valid = plans.filter((plan) => plan.ok);
  // Если в допуск не уложился ни один вариант — показываем самый близкий,
  // но с честной пометкой «вне допуска».
  const list = valid.length > 0 ? valid : plans;
  const variant = Math.abs(Math.trunc(options.variant ?? 0));

  return {
    plan: list[variant % list.length],
    variants: list.length,
    validVariants: valid.length,
  };
}

export interface ExchangeState {
  resourceId: string | null;
  quantity: number;
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

    const parsed = JSON.parse(raw) as { resourceId?: unknown; quantity?: unknown } | null;
    if (typeof parsed !== 'object' || parsed === null) return null;

    const resourceId = typeof parsed.resourceId === 'string' ? parsed.resourceId : null;
    const quantity =
      typeof parsed.quantity === 'number' && Number.isFinite(parsed.quantity)
        ? clampGiveQuantity(parsed.quantity)
        : MIN_GIVE_QUANTITY;

    return { resourceId, quantity };
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
