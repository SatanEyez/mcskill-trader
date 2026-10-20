export const MAX_TRADE_LINES = 32;
/** 10^18 — квинтиллион. */
export const MAX_TRADE_QUANTITY = 1_000_000_000_000_000_000;

export interface TradeLineInput {
  resource_id: string;
  quantity: number;
}

export interface TradeCalculationInput {
  side_a: TradeLineInput[];
  side_b: TradeLineInput[];
}

export interface TradeLineResult {
  resource_id: string;
  name: string;
  image_url: string;
  category: string;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface TradeSideResult {
  lines: TradeLineResult[];
  total: number;
  items_count: number;
  total_quantity: number;
}

export type TradeFavoredSide = 'a' | 'b' | 'balanced';

export interface TradeCalculationResult {
  side_a: TradeSideResult;
  side_b: TradeSideResult;
  /** Стоимость стороны Б минус стоимость стороны А. */
  delta: number;
  favored_side: TradeFavoredSide;
  /** Во сколько раз сторона Б дороже стороны А. */
  ratio: number | null;
}
