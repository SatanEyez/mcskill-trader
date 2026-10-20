import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** Компактный лог запросов без тел и заголовков (никаких паролей в логах). */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === 'test') {
    next();
    return;
  }

  const startedAt = performance.now();

  res.on('finish', () => {
    const duration = (performance.now() - startedAt).toFixed(1);
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.originalUrl} → ${status} (${duration} ms)`);
  });

  next();
};
