export interface ChatRoomRow {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by_login: string | null;
  created_at: Date | string;
  access_level: number | string;
  prefix_level: number | string;
  unread_count: number | string;
  last_message: string | null;
  last_message_login: string | null;
  last_message_at: Date | string | null;
}

export interface ChatRoomDto {
  id: string;
  name: string;
  /** Аватар комнаты: `/uploads/...` или внешний http(s)-адрес. */
  avatar_url: string | null;
  created_by_login: string | null;
  created_at: string;
  /** Минимальный уровень доступа, который видит комнату (0 — все с правом chat.use). */
  access_level: number;
  /** С какого уровня доступа в комнате видны префиксы авторов (0 — всем участникам). */
  prefix_level: number;
  /** Сколько сообщений пользователь ещё не прочитал (свои не считаются). */
  unread_count: number;
  last_message: {
    login: string;
    message: string;
    created_at: string;
  } | null;
}

/** Правка комнаты: название и/или аватар. Незаполненные поля не меняются. */
export interface UpdateRoomInput {
  name?: string;
  avatar_url?: string | null;
}

/** Уровень доступа роли и подпись для выбора в интерфейсе. */
export interface ChatAccessLevelDto {
  level: number;
  label: string;
}

export interface ChatMessageRow {
  id: string;
  room_id: string;
  user_id: string | null;
  user_login: string;
  avatar_url: string | null;
  prefix_name: string | null;
  prefix_color: string | null;
  prefix_is_shiny: boolean | number | null;
  image_url: string | null;
  message: string;
  created_at: Date | string;
}

export interface ChatMessageDto {
  id: string;
  room_id: string;
  user_id: string | null;
  user_login: string;
  avatar_url: string | null;
  /** Префикс (должность) автора на момент сообщения. */
  user_prefix: { name: string; color: string; is_shiny: boolean } | null;
  /** Ссылка на прикреплённое изображение (`/uploads/...`). */
  image_url: string | null;
  message: string;
  created_at: string;
}

export interface ListMessagesQuery {
  before?: string;
  limit: number;
}

/** Состояние комнаты и уровень доступа зрителя — для проверок видимости. */
export interface RoomAccess {
  accessLevel: number;
  prefixLevel: number;
  viewerLevel: number;
}
