import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { listAudit } from './audit.service.js';
import type { ListAuditQuery } from './audit.types.js';

export const listLogs: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListAuditQuery;
  const result = await listAudit(query);

  res.json({
    data: result.data,
    meta: {
      total: result.total,
      count: result.data.length,
      limit: query.limit,
      offset: query.offset,
    },
  });
});
