import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { requireAdmin } from '../../middleware/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { uploadImage } from './upload.controller.js';
import {
  MAX_UPLOAD_BYTES,
  UPLOADS_DIR,
  extensionForMime,
  isAllowedImageMime,
} from './upload.storage.js';

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOADS_DIR),
  filename: (_req, file, callback) => {
    const extension = isAllowedImageMime(file.mimetype) ? extensionForMime(file.mimetype) : '';
    callback(null, `${randomUUID()}${extension}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImageMime(file.mimetype)) {
      callback(new HttpError(422, 'Поддерживаются только PNG, JPG, WebP и GIF'));
      return;
    }

    callback(null, true);
  },
});

export const uploadRouter = Router();

// Загружать изображения может только действующий администратор.
uploadRouter.use(requireAdmin);

uploadRouter.post('/', (req, res, next) => {
  uploader.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof MulterError) {
      next(
        new HttpError(
          422,
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Файл больше 5 МБ — уменьшите изображение'
            : 'Не удалось прочитать файл: отправьте одно изображение полем «image»',
        ),
      );
      return;
    }

    next(error);
  });
}, uploadImage);
