import { z } from 'zod';
import { MAX_TRADE_LINES, MAX_TRADE_QUANTITY } from './trade.types.js';

const tradeLineSchema = z
  .object({
    resource_id: z.string().uuid('Некорректный идентификатор ресурса'),
    quantity: z.coerce
      .number({ invalid_type_error: 'Количество должно быть числом' })
      .int('Количество должно быть целым числом')
      .min(1, 'Количество должно быть больше нуля')
      .max(MAX_TRADE_QUANTITY, 'Слишком большое количество'),
  })
  .strict();

function uniqueResourceIds(lines: Array<{ resource_id: string }>): boolean {
  return new Set(lines.map((line) => line.resource_id)).size === lines.length;
}

const tradeSideSchema = z
  .array(tradeLineSchema)
  .max(MAX_TRADE_LINES, `В одной стороне может быть не больше ${MAX_TRADE_LINES} предметов`)
  .refine(uniqueResourceIds, 'Предметы в одной стороне не должны повторяться');

export const calculateTradeSchema = z
  .object({
    side_a: tradeSideSchema,
    side_b: tradeSideSchema,
  })
  .strict();
