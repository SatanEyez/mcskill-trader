import type {
  Resource,
  TradeCalculationResult,
  TradeLineResult,
  TradeSideResult,
} from '../types';

/** Ограничения синхронизированы с серверной схемой `trade.schema.ts`. */
export const MAX_TRADE_LINES = 32;
/** 10^18 — квинтиллион. */
export const MAX_TRADE_QUANTITY = 1_000_000_000_000_000_000;

export const TRADE_STORAGE_KEY = 'mcskill.trade.v1';

export interface TradeLine {
  resourceId: string;
  quantity: number;
}

export interface TradeState {
  sideA: TradeLine[];
  sideB: TradeLine[];
}

export type TradeSide = 'a' | 'b';

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_TRADE_QUANTITY, Math.max(1, Math.trunc(value)));
}

/** Добавляет предмет в сторону. Повторный выбор увеличивает количество. */
export function addLine(lines: TradeLine[], resourceId: string): TradeLine[] {
  const existing = lines.find((line) => line.resourceId === resourceId);

  if (existing) {
    return lines.map((line) =>
      line.resourceId === resourceId
        ? { ...line, quantity: clampQuantity(line.quantity + 1) }
        : line,
    );
  }

  if (lines.length >= MAX_TRADE_LINES) return lines;

  return [...lines, { resourceId, quantity: 1 }];
}

export function setLineQuantity(
  lines: TradeLine[],
  resourceId: string,
  quantity: number,
): TradeLine[] {
  const nextQuantity = clampQuantity(quantity);

  return lines.map((line) =>
    line.resourceId === resourceId ? { ...line, quantity: nextQuantity } : line,
  );
}

export function removeLine(lines: TradeLine[], resourceId: string): TradeLine[] {
  return lines.filter((line) => line.resourceId !== resourceId);
}

function calculateSide(
  lines: TradeLine[],
  resourcesById: Map<string, Resource>,
): TradeSideResult {
  const resultLines: TradeLineResult[] = [];

  for (const line of lines) {
    const resource = resourcesById.get(line.resourceId);
    if (!resource) continue;

    const unitPrice = round(resource.min_price);

    resultLines.push({
      resource_id: resource.id,
      name: resource.name,
      image_url: resource.image_url,
      category: resource.category,
      unit_price: unitPrice,
      quantity: line.quantity,
      total: round(unitPrice * line.quantity),
    });
  }

  return {
    lines: resultLines,
    total: round(resultLines.reduce((sum, line) => sum + line.total, 0)),
    items_count: resultLines.length,
    total_quantity: resultLines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/**
 * Локальный расчёт для мгновенного UI. Повторяет серверную формулу,
 * поэтому результат совпадает с `POST /api/trade/calculate`.
 */
export function calculateTradeLocal(
  sideA: TradeLine[],
  sideB: TradeLine[],
  resources: Resource[],
): TradeCalculationResult {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const resultA = calculateSide(sideA, resourcesById);
  const resultB = calculateSide(sideB, resourcesById);
  const delta = round(resultB.total - resultA.total);

  return {
    side_a: resultA,
    side_b: resultB,
    delta,
    favored_side: delta > 0 ? 'b' : delta < 0 ? 'a' : 'balanced',
    ratio: resultA.total > 0 ? round(resultB.total / resultA.total, 4) : null,
  };
}

export interface MinToMinChange {
  resourceId: string;
  name: string;
  unitPrice: number;
  from: number;
  to: number;
}

export interface MinToMinResult {
  /** Сторона, которую изменили, чтобы уравнять стоимости. */
  side: TradeSide;
  /** `increase` — добрали менее ценную сторону, `reduce` — уменьшили более ценную. */
  mode: 'increase' | 'reduce';
  /** Новые количества для этой стороны. */
  lines: TradeLine[];
  changes: MinToMinChange[];
  /** Стоимость второй стороны — до неё добираем. */
  reference_total: number;
  /** Стоимость пересчитанной стороны после округления. */
  total: number;
  changed: boolean;
}

/** Припуск для ceil: 2.0000000001 не должно превратиться в 3. */
const QUANTITY_EPSILON = 1e-9;

/**
 * «Минка к минке»: менее ценная сторона добирает количество до стоимости второй
 * по минимальным ценам каталога. Работает в обе стороны — и для «Я отдаю», и для «Я получаю».
 *
 * Правила:
 * - пропорции внутри стороны сохраняются — все строки получают один множитель;
 * - количество округляется вверх и не ниже 1, поэтому вторая сторона
 *   не получает меньше своих минималок — минимальную цену нарушить нельзя;
 * - если округление вверх перелетает цель сильнее текущего разрыва, ничего не меняем
 *   (`changed: false`) — иначе суммы «пинг-понговали» бы при повторных нажатиях;
 * - предметы с нулевой минималкой не трогаем, считать по ним нечего.
 *
 * `null` — считать нечего: одна из сторон пуста или у предметов нет цен.
 */
export function alignMinToMin(state: TradeState, resources: Resource[]): MinToMinResult | null {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const totals = calculateTradeLocal(state.sideA, state.sideB, resources);

  const side: TradeSide = totals.side_b.total <= totals.side_a.total ? 'b' : 'a';
  const sourceLines = side === 'b' ? state.sideB : state.sideA;
  const referenceTotal = side === 'b' ? totals.side_a.total : totals.side_b.total;
  const sourceTotal = side === 'b' ? totals.side_b.total : totals.side_a.total;

  if (sourceLines.length === 0 || referenceTotal <= 0) return null;

  const pricedById = new Map<string, { resource: Resource; unitPrice: number }>();

  for (const line of sourceLines) {
    const resource = resourcesById.get(line.resourceId);
    if (!resource) continue;

    pricedById.set(line.resourceId, { resource, unitPrice: round(resource.min_price) });
  }

  if (pricedById.size === 0) return null;

  const currentValue = sourceLines.reduce(
    (sum, line) => sum + (pricedById.get(line.resourceId)?.unitPrice ?? 0) * line.quantity,
    0,
  );

  if (currentValue <= 0) return null;

  const referenceSide: TradeSide = side === 'b' ? 'a' : 'b';
  const referenceLines = side === 'b' ? state.sideA : state.sideB;

  // Потолок стоимости, который можно получить, добрав количество до лимита.
  const maxSourceValue = sourceLines.reduce((sum, line) => {
    const unitPrice = pricedById.get(line.resourceId)?.unitPrice ?? 0;
    return sum + unitPrice * MAX_TRADE_QUANTITY;
  }, 0);

  // Добрать менее ценную сторону до потолка всё равно не хватает (цены слишком разные):
  // тогда уменьшаем более ценную сторону до текущей стоимости менее ценной.
  if (maxSourceValue < referenceTotal) {
    const factorDown = sourceTotal / referenceTotal;

    const reducedLines = referenceLines.map((line) => {
      const resource = resourcesById.get(line.resourceId);
      if (!resource) return line;

      return {
        ...line,
        quantity: clampQuantity(Math.max(1, Math.floor(line.quantity * factorDown))),
      };
    });

    const reducedById = new Map(reducedLines.map((line) => [line.resourceId, line]));
    const reduceChanges: MinToMinChange[] = [];

    for (const line of referenceLines) {
      const next = reducedById.get(line.resourceId);
      if (!next || next.quantity === line.quantity) continue;

      const resource = resourcesById.get(line.resourceId);

      reduceChanges.push({
        resourceId: line.resourceId,
        name: resource?.name ?? 'Предмет',
        unitPrice: round(resource?.min_price ?? 0),
        from: line.quantity,
        to: next.quantity,
      });
    }

    const reducedSide = calculateSide(reducedLines, resourcesById);

    return {
      side: referenceSide,
      mode: 'reduce',
      lines: reducedLines,
      changes: reduceChanges,
      reference_total: sourceTotal,
      total: reducedSide.total,
      changed: reduceChanges.length > 0,
    };
  }

  const factor = referenceTotal / currentValue;

  const lines = sourceLines.map((line) => {
    const entry = pricedById.get(line.resourceId);
    if (!entry || entry.unitPrice <= 0) return line;

    return { ...line, quantity: clampQuantity(Math.ceil(line.quantity * factor - QUANTITY_EPSILON)) };
  });

  const linesById = new Map(lines.map((line) => [line.resourceId, line]));
  const changes: MinToMinChange[] = [];

  for (const line of sourceLines) {
    const next = linesById.get(line.resourceId);
    if (!next || next.quantity === line.quantity) continue;

    const entry = pricedById.get(line.resourceId);

    changes.push({
      resourceId: line.resourceId,
      name: entry?.resource.name ?? 'Предмет',
      unitPrice: entry?.unitPrice ?? 0,
      from: line.quantity,
      to: next.quantity,
    });
  }

  const nextSide = calculateSide(lines, resourcesById);
  const gap = round(referenceTotal - sourceTotal);
  const overshoot = round(nextSide.total - referenceTotal);

  // Если округление вверх перелетает цель сильнее, чем текущий разрыв, — не трогаем:
  // точнее целыми штуками всё равно не выйдет, а значения начнут «пинг-понговать».
  if (gap <= 0 || overshoot >= gap) {
    return {
      side,
      mode: 'increase',
      lines: sourceLines,
      changes: [],
      reference_total: referenceTotal,
      total: sourceTotal,
      changed: false,
    };
  }

  return {
    side,
    mode: 'increase',
    lines,
    changes,
    reference_total: referenceTotal,
    total: nextSide.total,
    changed: changes.length > 0,
  };
}

function parseLines(value: unknown): TradeLine[] | null {
  if (!Array.isArray(value) || value.length > MAX_TRADE_LINES) return null;

  const seen = new Set<string>();
  const lines: TradeLine[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;

    const { resourceId, quantity } = item as Partial<TradeLine>;

    if (typeof resourceId !== 'string' || resourceId === '') return null;
    if (seen.has(resourceId)) return null;
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_TRADE_QUANTITY
    ) {
      return null;
    }

    seen.add(resourceId);
    lines.push({ resourceId, quantity });
  }

  return lines;
}

/** Убирает из сохранённого состояния предметы, которых больше нет в каталоге. */
export function pruneTradeState(state: TradeState, resources: Resource[]): TradeState {
  const knownIds = new Set(resources.map((resource) => resource.id));

  return {
    sideA: state.sideA.filter((line) => knownIds.has(line.resourceId)),
    sideB: state.sideB.filter((line) => knownIds.has(line.resourceId)),
  };
}

export function loadTradeState(): TradeState | null {
  try {
    const raw = localStorage.getItem(TRADE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { sideA?: unknown; sideB?: unknown } | null;
    if (typeof parsed !== 'object' || parsed === null) return null;

    const sideA = parseLines(parsed.sideA);
    const sideB = parseLines(parsed.sideB);
    if (!sideA || !sideB) return null;

    return { sideA, sideB };
  } catch {
    return null;
  }
}

export function saveTradeState(state: TradeState): void {
  try {
    localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Приватный режим или переполнение хранилища — просто не сохраняем.
  }
}
