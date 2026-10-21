import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireUuid } from '../../utils/uuid.js';
import * as chatService from './chat.service.js';
import type { ListMessagesQuery } from './chat.types.js';
import type { createRoomSchema, sendMessageSchema } from './chat.schema.js';
import type { z } from 'zod';

type CreateRoomBody = z.infer<typeof createRoomSchema>;
type SendMessageBody = z.infer<typeof sendMessageSchema>;

function getRoomId(req: Request): string {
  return requireUuid(req.params.id as string, 'идентификатор комнаты');
}

export const listRooms: RequestHandler = asyncHandler(async (req, res) => {
  const data = await chatService.listRooms(req.auth!.sub);
  res.json({ data, meta: { count: data.length } });
});

export const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as CreateRoomBody;
  const data = await chatService.createRoom(body.name, req.auth!);
  res.status(201).json({ data });
});

export const listMessages: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListMessagesQuery;
  const data = await chatService.listMessages(getRoomId(req), req.auth!.sub, query);
  res.json({ data, meta: { count: data.length } });
});

export const sendMessage: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as SendMessageBody;
  const data = await chatService.sendMessage(getRoomId(req), req.auth!, body.message);
  res.status(201).json({ data });
});

export const markRoomRead: RequestHandler = asyncHandler(async (req, res) => {
  await chatService.markRoomRead(getRoomId(req), req.auth!.sub);
  res.status(204).end();
});
