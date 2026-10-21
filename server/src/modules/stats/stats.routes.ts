import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { getVisitStats, listVisitors, trackVisit } from './stats.controller.js';
import { trackVisitSchema, visitorsQuerySchema, visitStatsQuerySchema } from './stats.schema.js';

export const statsRouter = Router();

/** Защита от накрутки: трекинг дешёвый, но публичный. */
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    // Трекинг не должен ломать страницу — просто молча игнорируем лишние запросы.
    res.status(204).end();
  },
});

// Публичный трекинг просмотра страницы.
statsRouter.post('/track', trackLimiter, validate(trackVisitSchema), trackVisit);

// Админ-статистика.
statsRouter.get(
  '/visits',
  requireAdmin,
  requirePermission('stats.view'),
  validate(visitStatsQuerySchema, 'query'),
  getVisitStats,
);

statsRouter.get(
  '/visitors',
  requireAdmin,
  requirePermission('stats.view'),
  validate(visitorsQuerySchema, 'query'),
  listVisitors,
);
