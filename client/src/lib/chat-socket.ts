import { io, type Socket } from 'socket.io-client';
import { getStoredToken } from './api';

let socket: Socket | null = null;
let socketToken: string | null = null;

/** Адрес Socket.io: в проде — тот же origin, в dev — через прокси Vite. */
function resolveSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (apiUrl && /^https?:/i.test(apiUrl)) {
    return new URL(apiUrl).origin;
  }

  return window.location.origin;
}

/**
 * Единое подключение чата на всё приложение.
 * Если токен сменился (вход/выход) — старое соединение пересоздаётся.
 */
export function getChatSocket(): Socket | null {
  const token = getStoredToken();

  if (!token) {
    disconnectChatSocket();
    return null;
  }

  if (socket && socketToken === token) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(resolveSocketUrl(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
  });

  return socket;
}

export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
