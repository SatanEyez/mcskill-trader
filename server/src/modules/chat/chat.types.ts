export interface ChatRoomRow {
  id: string;
  name: string;
  created_by_login: string | null;
  created_at: Date | string;
  unread_count: number | string;
  last_message: string | null;
  last_message_login: string | null;
  last_message_at: Date | string | null;
}

export interface ChatRoomDto {
  id: string;
  name: string;
  created_by_login: string | null;
  created_at: string;
  /** Сколько сообщений пользователь ещё не прочитал (свои не считаются). */
  unread_count: number;
  last_message: {
    login: string;
    message: string;
    created_at: string;
  } | null;
}

export interface ChatMessageRow {
  id: string;
  room_id: string;
  user_id: string | null;
  user_login: string;
  avatar_url: string | null;
  message: string;
  created_at: Date | string;
}

export interface ChatMessageDto {
  id: string;
  room_id: string;
  user_id: string | null;
  user_login: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
}

export interface ListMessagesQuery {
  before?: string;
  limit: number;
}
