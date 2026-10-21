import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { uploadImage } from './upload.controller.js';
import { createImageUploader } from './upload.middleware.js';

export const uploadRouter = Router();

// Загружать изображения может только действующий администратор.
uploadRouter.use(requireAdmin);

uploadRouter.post('/', createImageUploader('image'), uploadImage);
