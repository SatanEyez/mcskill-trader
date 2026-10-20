import { readFile, rename, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';
import {
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
  detectImageMime,
  extensionForMime,
} from './upload.storage.js';

/**
 * Принимает одно изображение (поле `image`), проверяет реальный формат
 * по сигнатуре и возвращает путь для поля `image_url` ресурса.
 */
export const uploadImage: RequestHandler = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new HttpError(422, 'Выберите файл изображения');
  }

  const uploadedPath = join(UPLOADS_DIR, file.filename);
  const buffer = await readFile(uploadedPath);
  const actualMime = detectImageMime(buffer);

  if (!actualMime) {
    await unlink(uploadedPath).catch(() => {});
    throw new HttpError(422, 'Файл не похож на изображение: нужен PNG, JPG, WebP или GIF');
  }

  // Расширение приводим к реальному формату, а не к заявленному в запросе.
  const expectedExtension = extensionForMime(actualMime);
  const currentExtension = extname(file.filename);
  let filename = file.filename;

  if (currentExtension.toLowerCase() !== expectedExtension) {
    filename = `${currentExtension ? file.filename.slice(0, -currentExtension.length) : file.filename}${expectedExtension}`;
    await rename(uploadedPath, join(UPLOADS_DIR, filename));
  }

  res.status(201).json({
    data: {
      url: `${UPLOADS_URL_PREFIX}/${filename}`,
      filename,
      mime: actualMime,
      size: file.size,
    },
  });
});
