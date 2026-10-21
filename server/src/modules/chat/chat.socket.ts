import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { logger } from '../../utils/logger.js';
import { passwordVersion, verifyUserToken } from '../auth/auth.tokens.js';
import { hasPermission, normalizePermissions } from '../rbac/permissions.js';
import { findSessionUser } from '../users/user.service.js';

/** То, что сокет знает о подключившемся администраторе. */
export interface ChatSocketUser {
  id: string;
  login: string;
}

let io: Server | null = null;

/**
 * Поднимает Socket.io на том же HTTP-сервере, что и REST API.
 * Авторизация — по JWT из handshake (cookie не используем).
 */
export function initChatSocket(server: HttpServer): Server {
  io = new Server(server, {
    path: '/socket.io',
    // Токен проверяется в handshake; credentials не нужны.
    cors: { origin: true, credentials: false },
  });

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token ?? '');

      if (!token) {
        next(new Error('unauthorized'));
        return;
      }

      const payload = verifyUserToken(token);
      const user = await findSessionUser(payload.sub);

      if (!user || user.status !== 'approved' || user.is_system) {
        next(new Error('unauthorized'));
        return;
      }

      if (payload.pv !== passwordVersion(user.password_hash)) {
        next(new Error('unauthorized'));
        return;
      }

      const permissions =
        user.role === 'owner' ? ['*'] : normalizePermissions(user.permissions);

      if (!hasPermission(permissions, 'chat.use')) {
        next(new Error('forbidden'));
        return;
      }

      socket.data.user = { id: user.id, login: user.login } satisfies ChatSocketUser;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as ChatSocketUser | undefined;
    socket.join('admins');
    logger.info(`Чат: подключился ${user?.login ?? 'неизвестный'}`);
  });

  logger.info('Чат: Socket.io готов');
  return io;
}

/** Отправляет событие всем авторизованным администраторам. */
export function emitToAdmins(event: string, payload: unknown): void {
  io?.to('admins').emit(event, payload);
}

export function closeChatSocket(): void {
  io?.close();
  io = null;
}
