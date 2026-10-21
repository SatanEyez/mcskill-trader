import { getDb } from '../../db/index.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  TradeCalculationInput,
  TradeCalculationResult,
  TradeFavoredSide,
  TradeLineInput,
  TradeLineResult,
  TradeSideResult,
} from './trade.types.js';

interface TradeResourceRow {
  id: string;
  name: string;
  image_url: string;
  min_price: string | number;
  category_name: string | null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function collectResourceIds(input: TradeCalculationInput): string[] {
  const ids = [...input.side_a, ...input.side_b].map((line) => line.resource_id);
  return Array.from(new Set(ids));
}

async function loadResources(ids: string[]): Promise<Map<string, TradeResourceRow>> {
  if (ids.length === 0) return new Map();

  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.query<TradeResourceRow>(
    `SELECT r.id,
            r.name,
            r.image_url,
            r.min_price,
            c.name AS category_name
       FROM resources AS r
       LEFT JOIN categories AS c ON c.id = r.category_id
      WHERE r.id IN (${placeholders})`,
    ids,
  );

  const resources = new Map(result.rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !resources.has(id));

  if (missing.length > 0) {
    throw new HttpError(404, 'Некоторые ресурсы не найдены', {
      missing_resource_ids: missing,
    });
  }

  return resources;
}

function calculateSide(
  lines: TradeLineInput[],
  resources: Map<string, TradeResourceRow>,
): TradeSideResult {
  const resultLines: TradeLineResult[] = lines.map((line) => {
    const resource = resources.get(line.resource_id)!;
    const unitPrice = round(Number(resource.min_price));

    return {
      resource_id: resource.id,
      name: resource.name,
      image_url: resource.image_url,
      category: resource.category_name ?? 'Без категории',
      unit_price: unitPrice,
      quantity: line.quantity,
      total: round(unitPrice * line.quantity),
    };
  });

  return {
    lines: resultLines,
    total: round(resultLines.reduce((sum, line) => sum + line.total, 0)),
    items_count: resultLines.length,
    total_quantity: resultLines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function calculateTrade(
  input: TradeCalculationInput,
): Promise<TradeCalculationResult> {
  const resources = await loadResources(collectResourceIds(input));

  const sideA = calculateSide(input.side_a, resources);
  const sideB = calculateSide(input.side_b, resources);
  const delta = round(sideB.total - sideA.total);

  let favoredSide: TradeFavoredSide = 'balanced';
  if (delta > 0) favoredSide = 'b';
  if (delta < 0) favoredSide = 'a';

  return {
    side_a: sideA,
    side_b: sideB,
    delta,
    favored_side: favoredSide,
    ratio: sideA.total > 0 ? round(sideB.total / sideA.total, 4) : null,
  };
}
