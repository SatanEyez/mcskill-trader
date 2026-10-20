import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { calculateTrade } from './trade.controller.js';
import { calculateTradeSchema } from './trade.schema.js';

export const tradeRouter = Router();

// Публичный расчёт: цены берутся из БД, клиент передаёт только состав сделки.
tradeRouter.post('/calculate', validate(calculateTradeSchema), calculateTrade);
