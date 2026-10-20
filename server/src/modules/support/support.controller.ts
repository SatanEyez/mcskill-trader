import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { logAction } from '../audit/audit.service.js';
import * as supportService from './support.service.js';
import type { CreateReportInput, ListTicketsQuery, UpdateTicketInput } from './support.schema.js';

function ticketId(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}

export const createReport: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validatedBody as CreateReportInput;
  const data = await supportService.createTicket(input, {
    ip: req.ip?.slice(0, 64) ?? null,
    userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
  });

  res.status(201).json({ data });
});

export const listTickets: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListTicketsQuery;
  const result = await supportService.listTickets(query);

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

export const ticketStats: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await supportService.getTicketCounts() });
});

export const updateTicket: RequestHandler = asyncHandler(async (req, res) => {
  const { data, previous } = await supportService.updateTicket(
    ticketId(req),
    req.validatedBody as UpdateTicketInput,
    req.auth!,
  );

  await logAction(req, {
    action: 'support.ticket_update',
    entityType: 'ticket',
    entityId: data.id,
    entityLabel: `#${data.ticket_no}`,
    details: {
      status: { from: previous.status, to: data.status },
      reply: Boolean(data.admin_reply),
      nick: data.nick,
    },
  });

  res.json({ data });
});
