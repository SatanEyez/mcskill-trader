import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { logAction } from '../audit/audit.service.js';
import * as settingsService from './settings.service.js';
import type { UpdateSiteSettingsInput } from './settings.schema.js';

export const getSiteSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await settingsService.getSiteSettings();
  res.json({ data });
});

export const updateSiteSettings: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validatedBody as UpdateSiteSettingsInput;
  const { data, previous } = await settingsService.updateSiteSettings(input, req.auth!);

  await logAction(req, {
    action: 'settings.update',
    entityType: 'settings',
    entityId: 'site',
    entityLabel: 'Оформление сайта',
    details: {
      halloween_enabled: {
        from: previous.halloween_enabled,
        to: data.halloween_enabled,
      },
    },
  });

  res.json({ data });
});
