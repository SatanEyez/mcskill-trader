import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createChatRoom,
  deleteChatRoom,
  fetchChatMessages,
  fetchChatRooms,
  markChatRoomRead,
  sendChatMessage,
  updateChatRoom,
} from '../lib/api';
import { getChatSocket } from '../lib/chat-socket';
import { isChatSoundEnabled, playChatSound } from '../lib/chat-sound';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, ChatRoom } from '../types';

/** Событие «в чате что-то изменилось» — для бейджа во вкладке. */
export const CHAT_UPDATED_EVENT = 'mcskill:chat-updated';

export function notifyChatUpdated(): void {
  window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
}

const PAGE_SIZE = 50;

interface SocketMessagePayload {
  message?: ChatMessage;
}

interface SocketRoomPayload {
  room?: ChatRoom;
}

/** Правка комнаты: приходят только изменённые поля. */
interface SocketRoomUpdatedPayload {
  room_id?: string;
  name?: string;
  avatar_url?: string | null;
}

interface SocketRoomDeletedPayload {
  room_id?: string;
}

function sortRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? a.created_at;
    const bTime = b.last_message?.created_at ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

function withMessage(room: ChatRoom, message: ChatMessage): ChatRoom {
  return {
    ...room,
    last_message: {
      login: message.user_login,
      message: message.message,
      created_at: message.created_at,
    },
  };
}

export function useChat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const activeRoomIdRef = useRef<string | null>(null);
  const userId = user?.id ?? null;
  const myLevel = user?.access_level ?? 0;
  // Список комнат для обработчиков сокета: там нужны актуальные данные без ре-рендера.
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const setActiveRoom = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
    setActiveRoomId(roomId);
  }, []);

  const loadRooms = useCallback(async (silent = false) => {
    if (!silent) setLoadingRooms(true);

    try {
      const data = await fetchChatRooms();
      setRooms(sortRooms(data));
      setError(null);
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof ApiError ? loadError.message : 'Не удалось загрузить чаты',
        );
      }
    } finally {
      if (!silent) setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const markRead = useCallback(async (roomId: string) => {
    try {
      await markChatRoomRead(roomId);
      setRooms((current) =>
        current.map((room) => (room.id === roomId ? { ...room, unread_count: 0 } : room)),
      );
      notifyChatUpdated();
    } catch {
      // Тихо: при следующем открытии комнаты прочитаем ещё раз.
    }
  }, []);

  const selectRoom = useCallback(
    async (roomId: string) => {
      setActiveRoom(roomId);
      setLoadingMessages(true);
      setMessages([]);
      setHasMore(false);
      setError(null);

      try {
        const data = await fetchChatMessages(roomId, { limit: PAGE_SIZE });
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
        void markRead(roomId);
      } catch (loadError) {
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : 'Не удалось загрузить сообщения',
        );
      } finally {
        setLoadingMessages(false);
      }
    },
    [markRead, setActiveRoom],
  );

  const loadOlder = useCallback(async () => {
    const roomId = activeRoomIdRef.current;
    const oldest = messages[0];

    if (!roomId || !oldest || loadingOlder || !hasMore) return;

    setLoadingOlder(true);

    try {
      const older = await fetchChatMessages(roomId, {
        before: oldest.created_at,
        limit: PAGE_SIZE,
      });

      setMessages((current) => [...older, ...current]);
      setHasMore(older.length === PAGE_SIZE);
    } catch {
      // Молча: пользователь может нажать ещё раз.
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages]);

  const send = useCallback(
    async (text: string, imageUrl?: string | null): Promise<boolean> => {
      const roomId = activeRoomIdRef.current;
      const trimmed = text.trim();
      const image = imageUrl ?? null;

      if (!roomId || (!trimmed && !image) || sending) return false;

      setSending(true);

      try {
        const message = await sendChatMessage(roomId, trimmed, image);
        // Сокет пришлёт это же сообщение всем, включая автора — дедуп по id.
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
        setRooms((current) =>
          current.map((room) =>
            room.id === message.room_id
              ? { ...withMessage(room, message), unread_count: 0 }
              : room,
          ),
        );
        notifyChatUpdated();
        return true;
      } catch (sendError) {
        setError(
          sendError instanceof ApiError ? sendError.message : 'Не удалось отправить сообщение',
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  const createRoom = useCallback(
    async (
      name: string,
      options: { accessLevel?: number; prefixLevel?: number } = {},
    ): Promise<ChatRoom | null> => {
      try {
        const room = await createChatRoom(name, options);
        setRooms((current) =>
          sortRooms([room, ...current.filter((item) => item.id !== room.id)]),
        );
        notifyChatUpdated();
        return room;
      } catch (createError) {
        setError(
          createError instanceof ApiError ? createError.message : 'Не удалось создать комнату',
        );
        return null;
      }
    },
    [],
  );

  /** Правка комнаты (название, аватар) — право chat.edit. */
  const updateRoom = useCallback(
    async (
      roomId: string,
      input: { name?: string; avatarUrl?: string | null },
    ): Promise<ChatRoom | null> => {
      try {
        const room = await updateChatRoom(roomId, input);
        setRooms((current) =>
          current.map((item) =>
            item.id === room.id
              ? { ...item, name: room.name, avatar_url: room.avatar_url }
              : item,
          ),
        );
        notifyChatUpdated();
        return room;
      } catch (updateError) {
        setError(
          updateError instanceof ApiError
            ? updateError.message
            : 'Не удалось изменить комнату',
        );
        return null;
      }
    },
    [],
  );

  /** Удаление комнаты — право chat.delete. */
  const deleteRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      try {
        await deleteChatRoom(roomId);
        setRooms((current) => current.filter((room) => room.id !== roomId));

        if (activeRoomIdRef.current === roomId) {
          setActiveRoom(null);
          setMessages([]);
          setHasMore(false);
        }

        notifyChatUpdated();
        return true;
      } catch (deleteError) {
        setError(
          deleteError instanceof ApiError
            ? deleteError.message
            : 'Не удалось удалить комнату',
        );
        return false;
      }
    },
    [setActiveRoom],
  );

  // Реалтайм: Socket.io присылает новые сообщения и комнаты.
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    const onMessage = (payload: SocketMessagePayload) => {
      const message = payload?.message;
      if (!message) return;

      const roomId = activeRoomIdRef.current;
      const isOwn = userId !== null && message.user_id === userId;
      const isActiveRoom = roomId === message.room_id;
      const visible = !document.hidden;
      // Комнаты, которых нет в списке (недоступные по уровню доступа), игнорируем.
      const knownRoom = roomsRef.current.some((room) => room.id === message.room_id);

      if (!knownRoom) return;

      if (isActiveRoom) {
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );

        if (!isOwn && visible) void markRead(message.room_id);
      }

      if (!isOwn && isChatSoundEnabled() && document.hidden) {
        playChatSound();
      }

      setRooms((current) => {
        const exists = current.some((room) => room.id === message.room_id);

        if (!exists) return current;

        return sortRooms(
          current.map((room) => {
            if (room.id !== message.room_id) return room;

            const next = withMessage(room, message);
            const countsAsUnread = !isOwn && !(isActiveRoom && visible);

            return {
              ...next,
              unread_count: countsAsUnread ? room.unread_count + 1 : 0,
            };
          }),
        );
      });

      notifyChatUpdated();
    };

    const onRoom = (payload: SocketRoomPayload) => {
      const room = payload?.room;
      if (!room) return;
      // Новая комната приходит всем: показываем только те, что доступны по уровню.
      if (room.access_level > myLevel) return;

      setRooms((current) =>
        sortRooms([room, ...current.filter((item) => item.id !== room.id)]),
      );
      notifyChatUpdated();
    };

    const onRoomUpdated = (payload: SocketRoomUpdatedPayload) => {
      const roomId = payload?.room_id;
      if (!roomId) return;

      setRooms((current) =>
        current.map((room) =>
          room.id === roomId
            ? {
                ...room,
                name: payload.name ?? room.name,
                avatar_url:
                  payload.avatar_url === undefined ? room.avatar_url : payload.avatar_url,
              }
            : room,
        ),
      );
      notifyChatUpdated();
    };

    const onRoomDeleted = (payload: SocketRoomDeletedPayload) => {
      const roomId = payload?.room_id;
      if (!roomId) return;

      setRooms((current) => current.filter((room) => room.id !== roomId));

      if (activeRoomIdRef.current === roomId) {
        setActiveRoom(null);
        setMessages([]);
        setHasMore(false);
      }

      notifyChatUpdated();
    };

    const onReconnect = () => {
      void loadRooms(true);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:room', onRoom);
    socket.on('chat:room-updated', onRoomUpdated);
    socket.on('chat:room-deleted', onRoomDeleted);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:room', onRoom);
      socket.off('chat:room-updated', onRoomUpdated);
      socket.off('chat:room-deleted', onRoomDeleted);
      socket.off('connect', onReconnect);
    };
  }, [loadRooms, markRead, setActiveRoom, userId, myLevel]);

  // Вернулись на вкладку — дочитываем активную комнату.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && activeRoomIdRef.current) {
        void markRead(activeRoomIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [markRead]);

  return {
    rooms,
    activeRoomId,
    messages,
    loadingRooms,
    loadingMessages,
    loadingOlder,
    sending,
    error,
    hasMore,
    selectRoom,
    loadOlder,
    send,
    createRoom,
    updateRoom,
    deleteRoom,
    reload: loadRooms,
    setError,
  };
}

/** Суммарный счётчик непрочитанных для бейджа во вкладке «Служебный чат». */
export function useChatUnreadBadge(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let active = true;

    const load = () => {
      fetchChatRooms()
        .then((rooms) => {
          if (active) {
            setCount(rooms.reduce((sum, room) => sum + room.unread_count, 0));
          }
        })
        .catch(() => {
          // Бейдж не критичен для работы панели.
        });
    };

    load();
    window.addEventListener(CHAT_UPDATED_EVENT, load);

    const socket = getChatSocket();
    const onMessage = () => load();

    socket?.on('chat:message', onMessage);
    socket?.on('chat:room', onMessage);
    socket?.on('connect', load);

    return () => {
      active = false;
      window.removeEventListener(CHAT_UPDATED_EVENT, load);
      socket?.off('chat:message', onMessage);
      socket?.off('chat:room', onMessage);
      socket?.off('connect', load);
    };
  }, [enabled]);

  return count;
}
