import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createRoom,
  listMessages,
  listRooms,
  markRoomRead,
  sendMessage,
} from './chat.controller.js';
import {
  createRoomSchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from './chat.schema.js';

export const chatRouter = Router();

// Служебный чат доступен только с правом chat.use.
chatRouter.use(requireAdmin, requirePermission('chat.use'));

chatRouter.get('/rooms', listRooms);
chatRouter.post('/rooms', validate(createRoomSchema), createRoom);
chatRouter.get('/rooms/:id/messages', validate(listMessagesQuerySchema, 'query'), listMessages);
chatRouter.post('/rooms/:id/messages', validate(sendMessageSchema), sendMessage);
chatRouter.post('/rooms/:id/read', markRoomRead);
