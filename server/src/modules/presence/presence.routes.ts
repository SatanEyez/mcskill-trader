import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { listOnlineAdmins, PRESENCE_WINDOW_MINUTES } from './presence.service.js';

const list: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({
    data: await listOnlineAdmins(),
    meta: { window_minutes: PRESENCE_WINDOW_MINUTES },
  });
});

export const presenceRouter = Router();

// Публичный блок «В сети администраторы» на главной странице.
presenceRouter.get('/admins', list);
