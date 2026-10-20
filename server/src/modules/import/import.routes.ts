import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { importHistory, importPrices } from './import.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 2,
  },
});

export const importRouter = Router();

importRouter.use(requireAdmin);
importRouter.use(requirePermission('import.run'));

importRouter.post(
  '/prices',
  upload.fields([
    { name: 'prices', maxCount: 1 },
    { name: 'sprite', maxCount: 1 },
  ]),
  importPrices,
);
importRouter.get('/jobs', importHistory);
