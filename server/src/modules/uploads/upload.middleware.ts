import multer, { MulterError } from 'multer';
import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { MAX_UPLOAD_BYTES, isAllowedImageMime } from './upload.storage.js';

/**
 * Принимает одно изображение в память: файл сразу уходит в базу
 * (`uploaded_files`), поэтому диск не нужен.
 */
export function createImageUploader(
  field: string,
  maxBytes = MAX_UPLOAD_BYTES,
): RequestHandler {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!isAllowedImageMime(file.mimetype)) {
        callback(new HttpError(422, 'Поддерживаются только PNG, JPG, WebP и GIF'));
        return;
      }

      callback(null, true);
    },
  });

  return (req, res, next) => {
    uploader.single(field)(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof MulterError) {
        const megabytes = Math.max(1, Math.round(maxBytes / (1024 * 1024)));

        next(
          new HttpError(
            422,
            error.code === 'LIMIT_FILE_SIZE'
              ? `Файл больше ${megabytes} МБ — уменьшите изображение`
              : `Не удалось прочитать файл: отправьте одно изображение полем «${field}»`,
          ),
        );
        return;
      }

      next(error);
    });
  };
}
