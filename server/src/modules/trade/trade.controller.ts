import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { calculateTradeSchema } from './trade.schema.js';
import * as tradeService from './trade.service.js';
import type { TradeCalculationInput } from './trade.types.js';

type CalculateBody = z.infer<typeof calculateTradeSchema>;

export const calculateTrade: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as CalculateBody;
  const data = await tradeService.calculateTrade(body as TradeCalculationInput);
  res.json({ data });
});
