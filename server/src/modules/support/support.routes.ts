import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createReport,
  listTickets,
  ticketStats,
  updateTicket,
} from './support.controller.js';
import {
  createReportSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from './support.schema.js';

export const supportRouter = Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: 'Слишком много обращений с этого адреса. Попробуйте позже' },
    });
  },
});

// Публичная форма репорта.
supportRouter.post('/reports', reportLimiter, validate(createReportSchema), createReport);

// Админ-раздел «Обращения».
supportRouter.get(
  '/tickets',
  requireAdmin,
  requirePermission('support.read'),
  validate(listTicketsQuerySchema, 'query'),
  listTickets,
);
supportRouter.get(
  '/tickets/stats',
  requireAdmin,
  requirePermission('support.read'),
  ticketStats,
);
supportRouter.put(
  '/tickets/:id',
  requireAdmin,
  requirePermission('support.write'),
  validate(ticketIdParamSchema, 'params'),
  validate(updateTicketSchema),
  updateTicket,
);
