import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { getSiteSettings, updateSiteSettings } from './settings.controller.js';
import { updateSiteSettingsSchema } from './settings.schema.js';

export const settingsRouter = Router();

// Публичные настройки нужны каждому посетителю, чтобы применить оформление.
settingsRouter.get('/', getSiteSettings);

settingsRouter.put(
  '/',
  requireAdmin,
  requirePermission('settings.manage'),
  validate(updateSiteSettingsSchema),
  updateSiteSettings,
);
