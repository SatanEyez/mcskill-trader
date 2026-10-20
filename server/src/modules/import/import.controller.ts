import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';
import { listImportJobs, runPriceImport } from './import.service.js';

interface UploadedFiles {
  prices?: Express.Multer.File[];
  sprite?: Express.Multer.File[];
}

export const importPrices: RequestHandler = asyncHandler(async (req, res) => {
  const files = (req.files ?? {}) as UploadedFiles;
  const prices = files.prices?.[0];
  const sprite = files.sprite?.[0];

  if (!prices) {
    throw new HttpError(422, 'Прикрепите JSON-файл прайса (поле prices)');
  }

  if (!sprite) {
    throw new HttpError(422, 'Прикрепите спрайт icons.png (поле sprite)');
  }

  const summary = await runPriceImport(
    req,
    prices.buffer,
    sprite.buffer,
    prices.originalname || 'prices.json',
  );

  res.status(201).json({ data: summary });
});

export const importHistory: RequestHandler = asyncHandler(async (req: Request, res) => {
  const limitRaw = Number(req.query.limit ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.round(limitRaw))) : 20;

  res.json({ data: await listImportJobs(limit) });
});
