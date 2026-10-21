import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createRoom,
  listAccessLevels,
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
// Названия уровней доступа нужны и форме создания комнаты, и подписям в списке.
chatRouter.get('/access-levels', listAccessLevels);
// Создание комнат — отдельное право chat.create (выдаётся в разделе «Доступ»).
chatRouter.post('/rooms', requirePermission('chat.create'), validate(createRoomSchema), createRoom);
chatRouter.get('/rooms/:id/messages', validate(listMessagesQuerySchema, 'query'), listMessages);
chatRouter.post('/rooms/:id/messages', validate(sendMessageSchema), sendMessage);
chatRouter.post('/rooms/:id/read', markRoomRead);
