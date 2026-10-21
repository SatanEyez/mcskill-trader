import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireUuid } from '../../utils/uuid.js';
import * as chatService from './chat.service.js';
import type { ListMessagesQuery } from './chat.types.js';
import type { createRoomSchema, sendMessageSchema, updateRoomSchema } from './chat.schema.js';
import type { z } from 'zod';

type CreateRoomBody = z.infer<typeof createRoomSchema>;
type SendMessageBody = z.infer<typeof sendMessageSchema>;
type UpdateRoomBody = z.infer<typeof updateRoomSchema>;

function getRoomId(req: Request): string {
  return requireUuid(req.params.id as string, 'идентификатор комнаты');
}

export const listRooms: RequestHandler = asyncHandler(async (req, res) => {
  const data = await chatService.listRooms(req.auth!.sub);
  res.json({ data, meta: { count: data.length } });
});

export const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as CreateRoomBody;
  const data = await chatService.createRoom(
    body.name,
    body.access_level ?? 0,
    body.prefix_level ?? 0,
    req.auth!,
  );
  res.status(201).json({ data });
});

export const listAccessLevels: RequestHandler = asyncHandler(async (req, res) => {
  const data = await chatService.listAccessLevels(req.auth!.sub);
  res.json({ data: data.levels, meta: { my_level: data.myLevel } });
});

export const listMessages: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListMessagesQuery;
  const data = await chatService.listMessages(getRoomId(req), req.auth!.sub, query);
  res.json({ data, meta: { count: data.length } });
});

export const sendMessage: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as SendMessageBody;
  const data = await chatService.sendMessage(
    getRoomId(req),
    req.auth!,
    body.message ?? '',
    body.image_url ?? null,
  );
  res.status(201).json({ data });
});

export const updateRoom: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validatedBody as UpdateRoomBody;
  const data = await chatService.updateRoom(getRoomId(req), req.auth!, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.avatar_url !== undefined
      ? { avatar_url: body.avatar_url === '' ? null : body.avatar_url }
      : {}),
  });
  res.json({ data });
});

export const deleteRoom: RequestHandler = asyncHandler(async (req, res) => {
  await chatService.deleteRoom(getRoomId(req), req.auth!);
  res.status(204).end();
});

export const markRoomRead: RequestHandler = asyncHandler(async (req, res) => {
  await chatService.markRoomRead(getRoomId(req), req.auth!.sub);
  res.status(204).end();
});
