import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { listLogs } from './audit.controller.js';
import { listAuditQuerySchema } from './audit.schema.js';

export const auditRouter = Router();

// Журнал действий доступен только администраторам с правом logs.read.
auditRouter.use(requireAdmin);
auditRouter.get(
  '/',
  requirePermission('logs.read'),
  validate(listAuditQuerySchema, 'query'),
  listLogs,
);
