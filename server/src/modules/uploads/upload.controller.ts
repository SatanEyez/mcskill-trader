import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';
import {
  UPLOADS_URL_PREFIX,
  detectImageMime,
  saveUploadedFile,
} from './upload.storage.js';

/**
 * Принимает одно изображение (поле `image`), проверяет реальный формат
 * по сигнатуре, кладёт файл в базу и возвращает путь для поля `image_url`.
 */
export const uploadImage: RequestHandler = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new HttpError(422, 'Выберите файл изображения');
  }

  const actualMime = detectImageMime(file.buffer);

  if (!actualMime) {
    throw new HttpError(422, 'Файл не похож на изображение: нужен PNG, JPG, WebP или GIF');
  }

  const filename = await saveUploadedFile(file.buffer, actualMime);

  res.status(201).json({
    data: {
      url: `${UPLOADS_URL_PREFIX}/${filename}`,
      filename,
      mime: actualMime,
      size: file.buffer.length,
    },
  });
});
