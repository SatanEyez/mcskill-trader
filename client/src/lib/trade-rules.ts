import type { Resource, TradeCalculationResult, TradeLineResult } from '../types';
import { formatPrice } from './format';

/**
 * Проверки сделки по правилам экономики McSkill (раздел 9).
 *
 * В калькуляторе все цены берутся из минималок, поэтому п. 9.6 и 9.9
 * выполняются по построению. Проверки 9.7, 9.10 и 9.11 зависят от состава
 * сделки и показываются в интерфейсе.
 *
 * Классификация лёгкодобываемых и труднодоступных предметов ведётся по
 * названию: списки ниже можно расширять по мере появления новых ресурсов.
 */

export type TradeRuleId = '9.6' | '9.7' | '9.9' | '9.10' | '9.11';
export type TradeRuleSeverity = 'violation' | 'warning';

export interface TradeRuleNotice {
  id: string;
  rule: TradeRuleId;
  severity: TradeRuleSeverity;
  title: string;
  message: string;
  items: string[];
}

export interface TradeRulesReport {
  notices: TradeRuleNotice[];
  violations: number;
  warnings: number;
  /** Правила, которые проверены всегда (цена и оценка по минималке). */
  checkedRules: TradeRuleId[];
}

/** Допустимое превышение минимальной цены по п. 9.6. */
const PRICE_CAP_TIERS = [
  { upTo: 1_000_000, multiplier: 10 },
  { upTo: 10_000_000, multiplier: 5 },
  { upTo: Number.POSITIVE_INFINITY, multiplier: 2 },
] as const;

export function priceCapMultiplier(minPrice: number): number {
  return PRICE_CAP_TIERS.find((tier) => minPrice <= tier.upTo)?.multiplier ?? 2;
}

/** Максимальная цена предмета относительно его минималки (п. 9.6). */
export function maxAllowedPrice(minPrice: number): number {
  return Math.round(minPrice * priceCapMultiplier(minPrice) * 100) / 100;
}

/**
 * П. 9.10: равноценность считается с погрешностью 10% от суммы стороны сделки.
 * Считаем от меньшей стороны — тогда 10% выполняются от любой из сумм:
 * если разница уложилась в 10% от меньшей, она уложится и в 10% от большей.
 */
export const EQUALITY_TOLERANCE_SHARE = 0.1;

/**
 * База для процента: сумма меньшей (более дешёвой) стороны сделки.
 * Так «разница 17,7%» читается по-человечески: 27 488 825,64 больше
 * 23 349 420,80 именно на 17,7%, а не на 8,1% от суммы обеих сторон.
 */
export function equalityToleranceBase(result: TradeCalculationResult): number {
  const smaller = Math.min(result.side_a.total, result.side_b.total);

  // Если одна сторона пуста, процентом считается вся разница (100%).
  return smaller > 0 ? smaller : Math.max(result.side_a.total, result.side_b.total);
}

/** Допустимая разница сторон в монетах: 10% от суммы меньшей стороны. */
export function equalityTolerance(result: TradeCalculationResult): number {
  return Math.round(equalityToleranceBase(result) * EQUALITY_TOLERANCE_SHARE * 100) / 100;
}

/** Текущая разница сторон в процентах от суммы меньшей стороны. */
export function equalityGapPercent(result: TradeCalculationResult): number {
  const base = equalityToleranceBase(result);

  if (base <= 0) return 0;

  return (Math.abs(result.delta) / base) * 100;
}

export function isWithinEqualityTolerance(result: TradeCalculationResult): boolean {
  return Math.abs(result.delta) <= equalityTolerance(result);
}

/** Процент разницы для интерфейса: «17,7%», «10,0%», «124,4%». */
export function formatGapPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';

  // Один знак после запятой: иначе 17,73% превращалось в «18%» и расходилось
  // с тем, что человек считает на калькуляторе.
  return `${value.toFixed(1).replace('.', ',')}%`;
}

/** Предметы, публичная раздача которых запрещена п. 9.7. */
const GIVEAWAY_PREFIXES = [
  'земля',
  'булыжник',
  'камень',
  'каменный блок',
  'стекло',
  'стеклянный блок',
  'песок',
];

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isGiveawayRestricted(name: string): boolean {
  const normalized = normalizeName(name);

  return GIVEAWAY_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix} `) ||
      normalized.startsWith(`${prefix}-`),
  );
}

interface ItemClassification {
  easy: boolean;
  hard: boolean;
  easyReasons: string[];
  hardReasons: string[];
}

/** Легкодобываемые ресурсы из п. 9.11: пасеки, материя, молекулярные фермы, репликатор. */
const EASY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /матери[яию]/i, reason: 'материя' },
  {
    pattern: /пчел|пчёл|мёд|медов|соты|сота|сотов|воск|прополис|пыльц|маточн/i,
    reason: 'ресурсы пасеки',
  },
  { pattern: /молекуляр/i, reason: 'молекулярная ферма' },
  { pattern: /репликатор|репликац/i, reason: 'репликатор' },
];

/** Труднодоступные предметы из п. 9.11: энергия, эндгейм, слияния от пробуждённого. */
const HARD_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /квг|квантов|пробужд[её]н|слияни|энд-?гейм/i, reason: 'энергия/эндгейм' },
  { pattern: /фотон|нейтрин|сингуляр/i, reason: 'старшая панель/энергия' },
  {
    pattern:
      /незерит|древн[а-яё]*\s+облом|эхо-осколок|осколок панциря|звезда нижнего мира|тотем бессмертия|трезубец|элитр|маяк|дракон|шалкер|зачарованное золотое яблоко/i,
    reason: 'эндгейм-предмет',
  },
];

/** Исключения из п. 9.11: примитивный КВГ со схемами и панели до хромированных. */
const HARD_EXCEPTIONS: RegExp[] = [
  /примитивн[а-яё]*\s+квг/i,
  /квг[а-яё]*\s+примитивн/i,
  /панел[а-яё]*\s+(?:до\s+)?хром/i,
];

export function classifyTradeItem(name: string): ItemClassification {
  const easyReasons = EASY_PATTERNS.filter(({ pattern }) => pattern.test(name)).map(
    ({ reason }) => reason,
  );
  const isHardException = HARD_EXCEPTIONS.some((pattern) => pattern.test(name));
  // Если предмет одновременно похож на лёгкий и трудный (например, энергетические соты),
  // приоритет у лёгкого: иначе сделки с пасекой давали бы ложные нарушения.
  const hardReasons =
    easyReasons.length > 0 || isHardException
      ? []
      : HARD_PATTERNS.filter(({ pattern }) => pattern.test(name)).map(({ reason }) => reason);

  return {
    easy: easyReasons.length > 0,
    hard: hardReasons.length > 0,
    easyReasons,
    hardReasons,
  };
}

function uniqueNames(lines: TradeLineResult[]): string[] {
  return [...new Set(lines.map((line) => line.name))];
}

function joinNames(names: string[]): string {
  return names.join(', ');
}

function checkPriceBounds(
  lines: TradeLineResult[],
  resources: Resource[],
): { underpriced: TradeLineResult[]; overpriced: TradeLineResult[] } {
  const minPriceById = new Map(resources.map((resource) => [resource.id, resource.min_price]));
  const underpriced: TradeLineResult[] = [];
  const overpriced: TradeLineResult[] = [];

  for (const line of lines) {
    const minPrice = minPriceById.get(line.resource_id);
    if (minPrice === undefined) continue;

    if (line.unit_price < minPrice - 0.005) {
      underpriced.push(line);
    } else if (line.unit_price > maxAllowedPrice(minPrice) + 0.005) {
      overpriced.push(line);
    }
  }

  return { underpriced, overpriced };
}

/**
 * Проверяет текущую сделку по п. 9.6, 9.7, 9.9, 9.10 и 9.11.
 * Возвращает только проблемы: если нарушений нет, список notices пуст.
 */
export function checkTradeRules(
  result: TradeCalculationResult,
  resources: Resource[],
): TradeRulesReport {
  const notices: TradeRuleNotice[] = [];
  const sideA = result.side_a.lines;
  const sideB = result.side_b.lines;

  // 9.6 — цена не должна выходить за минимальную и допустимый потолок.
  const { underpriced, overpriced } = checkPriceBounds([...sideA, ...sideB], resources);

  if (underpriced.length > 0) {
    notices.push({
      id: 'price-below-min',
      rule: '9.6',
      severity: 'violation',
      title: 'Цена ниже минимальной',
      message:
        'Правило 9.6 требует оценивать товар не ниже установленной минимальной цены. ' +
        'Проверьте позиции, у которых цена в сделке ниже минималки.',
      items: uniqueNames(underpriced),
    });
  }

  if (overpriced.length > 0) {
    notices.push({
      id: 'price-above-cap',
      rule: '9.6',
      severity: 'violation',
      title: 'Цена выше допустимого потолка',
      message:
        'Правило 9.6 ограничивает превышение минимальной цены: до 1 млн — ×10, ' +
        'от 1 до 10 млн — ×5, свыше 10 млн — ×2. Эти позиции выходят за потолок.',
      items: uniqueNames(overpriced),
    });
  }

  // 9.7 — запрещена публичная раздача земли, булыжника, камня, стекла и песка.
  const giveawayA = sideA.filter((line) => isGiveawayRestricted(line.name));
  const giveawayB = sideB.filter((line) => isGiveawayRestricted(line.name));

  // Сторона с монетами — уже не пустая: это обмен, а не раздача.
  const sideAEmpty = sideA.length === 0 && result.side_a.coins <= 0;
  const sideBEmpty = sideB.length === 0 && result.side_b.coins <= 0;

  if (sideAEmpty && giveawayB.length > 0) {
    notices.push({
      id: 'giveaway-side-b',
      rule: '9.7',
      severity: 'violation',
      title: 'Запрещённая раздача',
      message:
        'Правило 9.7 запрещает публично раздавать землю, булыжник, камень, стекло и песок. ' +
        'В этой сделке их отдают без встречной стороны.',
      items: uniqueNames(giveawayB),
    });
  }

  if (sideBEmpty && giveawayA.length > 0) {
    notices.push({
      id: 'giveaway-side-a',
      rule: '9.7',
      severity: 'violation',
      title: 'Запрещённая раздача',
      message:
        'Правило 9.7 запрещает публично раздавать землю, булыжник, камень, стекло и песок. ' +
        'В этой сделке вы отдаёте их без встречной стороны.',
      items: uniqueNames(giveawayA),
    });
  }

  // 9.10 — неравноценный обмен без подтверждённой доплаты.
  if (
    (sideA.length > 0 || result.side_a.coins > 0) &&
    (sideB.length > 0 || result.side_b.coins > 0) &&
    Math.abs(result.delta) > 0.005 &&
    !isWithinEqualityTolerance(result)
  ) {
    notices.push({
      id: 'unequal-exchange',
      rule: '9.10',
      severity: 'warning',
      title: 'Стороны не равноценны',
      message:
        `Разница с учётом монет — ${formatPrice(Math.abs(result.delta))} монет, ` +
        `это ${formatGapPercent(equalityGapPercent(result))} от меньшей стороны сделки. ` +
        'Доплата должна пройти в игре и подтверждаться логами сервера, иначе сделку могут ' +
        'квалифицировать как неравноценный обмен (п. 9.10). Допустимая погрешность — 10% ' +
        `от меньшей стороны (${formatPrice(equalityTolerance(result))} монет).`,
      items: [],
    });
  }

  // 9.11 — нельзя обменивать легкодобываемые ресурсы на труднодоступные.
  const classifiedA = sideA.map((line) => ({ line, ...classifyTradeItem(line.name) }));
  const classifiedB = sideB.map((line) => ({ line, ...classifyTradeItem(line.name) }));

  const easyA = classifiedA.filter((item) => item.easy).map((item) => item.line);
  const hardA = classifiedA.filter((item) => item.hard).map((item) => item.line);
  const easyB = classifiedB.filter((item) => item.easy).map((item) => item.line);
  const hardB = classifiedB.filter((item) => item.hard).map((item) => item.line);

  const easyToHard = easyA.length > 0 && hardB.length > 0;
  const hardToEasy = hardA.length > 0 && easyB.length > 0;

  if (easyToHard || hardToEasy) {
    const easyNames = uniqueNames([...easyA, ...easyB]);
    const hardNames = uniqueNames([...hardA, ...hardB]);

    notices.push({
      id: 'easy-to-hard',
      rule: '9.11',
      severity: 'violation',
      title: 'Лёгкое на труднодоступное',
      message:
        'Правило 9.11 запрещает обменивать легкодобываемые/неограниченные ресурсы на ' +
        'труднодоступные предметы. Запрет действует независимо от количества, способа ' +
        'обмена и промежуточных сделок.',
      items: [
        `Лёгкодобываемые: ${joinNames(easyNames)}`,
        `Труднодоступные: ${joinNames(hardNames)}`,
      ],
    });
  }

  return {
    notices,
    violations: notices.filter((notice) => notice.severity === 'violation').length,
    warnings: notices.filter((notice) => notice.severity === 'warning').length,
    checkedRules: ['9.6', '9.9'],
  };
}
