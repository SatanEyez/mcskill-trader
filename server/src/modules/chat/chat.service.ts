import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import { emitToAdmins } from './chat.socket.js';
import type {
  ChatMessageDto,
  ChatMessageRow,
  ChatRoomDto,
  ChatRoomRow,
  ListMessagesQuery,
} from './chat.types.js';

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_ROOM_NAME_MAX_LENGTH = 60;

const ROOM_SELECT = `
  SELECT r.id,
         r.name,
         r.created_by_login,
         r.created_at,
         (SELECT COUNT(*)
            FROM chat_messages AS m
           WHERE m.room_id = r.id
             AND (m.user_id IS NULL OR m.user_id <> ?)
             AND m.created_at > COALESCE(rd.last_read_at, '1970-01-01 00:00:00')) AS unread_count,
         (SELECT m.message
            FROM chat_messages AS m
           WHERE m.room_id = r.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1) AS last_message,
         (SELECT m.user_login
            FROM chat_messages AS m
           WHERE m.room_id = r.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1) AS last_message_login,
         (SELECT m.created_at
            FROM chat_messages AS m
           WHERE m.room_id = r.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1) AS last_message_at
    FROM chat_rooms AS r
    LEFT JOIN chat_reads AS rd ON rd.room_id = r.id AND rd.user_id = ?
`;

function toRoomDto(row: ChatRoomRow): ChatRoomDto {
  return {
    id: row.id,
    name: row.name,
    created_by_login: row.created_by_login,
    created_at: toIso(row.created_at),
    unread_count: Number(row.unread_count ?? 0),
    last_message:
      row.last_message === null || row.last_message === undefined
        ? null
        : {
            login: row.last_message_login ?? '—',
            message: row.last_message,
            created_at: toIso(row.last_message_at as Date | string),
          },
  };
}

function toMessageDto(row: ChatMessageRow): ChatMessageDto {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    user_login: row.user_login,
    avatar_url: row.avatar_url ?? null,
    user_prefix:
      row.prefix_name && row.prefix_color
        ? { name: row.prefix_name, color: row.prefix_color }
        : null,
    image_url: row.image_url ?? null,
    message: row.message,
    created_at: toIso(row.created_at),
  };
}

const MESSAGE_SELECT = `
  SELECT m.id,
         m.room_id,
         m.user_id,
         m.user_login,
         m.image_url,
         u.avatar_url,
         p.name AS prefix_name,
         p.color AS prefix_color,
         m.message,
         m.created_at
    FROM chat_messages AS m
    LEFT JOIN admin_users AS u ON u.id = m.user_id
    LEFT JOIN admin_prefixes AS p ON p.id = u.prefix_id
`;

/** Все комнаты с числом непрочитанных и последним сообщением. */
export async function listRooms(userId: string): Promise<ChatRoomDto[]> {
  const db = await getDb();
  const result = await db.query<ChatRoomRow>(
    `${ROOM_SELECT}
      ORDER BY COALESCE(last_message_at, r.created_at) DESC, r.name ASC`,
    [userId, userId],
  );

  return result.rows.map(toRoomDto);
}

export async function getRoom(roomId: string, userId: string): Promise<ChatRoomDto> {
  const db = await getDb();
  const result = await db.query<ChatRoomRow>(`${ROOM_SELECT} WHERE r.id = ?`, [
    userId,
    userId,
    roomId,
  ]);
  const row = result.rows[0];

  if (!row) {
    throw new HttpError(404, 'Комната не найдена');
  }

  return toRoomDto(row);
}

async function assertRoomExists(roomId: string): Promise<void> {
  const db = await getDb();
  const result = await db.query<{ id: string }>('SELECT id FROM chat_rooms WHERE id = ?', [roomId]);

  if (result.rows.length === 0) {
    throw new HttpError(404, 'Комната не найдена');
  }
}

export async function createRoom(name: string, actor: AuthPayload): Promise<ChatRoomDto> {
  const db = await getDb();
  const trimmed = name.trim();

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM chat_rooms WHERE LOWER(name) = LOWER(?)',
    [trimmed],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Комната с таким названием уже существует');
  }

  const id = randomUUID();

  await db.query(
    `INSERT INTO chat_rooms (id, name, created_by, created_by_login)
     VALUES (?, ?, ?, ?)`,
    [id, trimmed, actor.sub, actor.login],
  );

  const room = await getRoom(id, actor.sub);
  emitToAdmins('chat:room', { room });

  return room;
}

/** История сообщений: порция «до» указанного времени, от старых к новым. */
export async function listMessages(
  roomId: string,
  userId: string,
  query: ListMessagesQuery,
): Promise<ChatMessageDto[]> {
  await assertRoomExists(roomId);

  const db = await getDb();
  const params: unknown[] = [roomId];
  let whereSql = 'WHERE m.room_id = ?';

  if (query.before) {
    params.push(new Date(query.before));
    whereSql += ' AND m.created_at < ?';
  }

  params.push(query.limit);

  const result = await db.query<ChatMessageRow>(
    `${MESSAGE_SELECT} ${whereSql}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?`,
    params,
  );

  return result.rows.reverse().map(toMessageDto);
}

/** UPSERT отметки прочтения: чат считается прочитанным до этого момента. */
export async function markRoomRead(roomId: string, userId: string): Promise<void> {
  await assertRoomExists(roomId);
  const db = await getDb();

  await db.query(
    `INSERT INTO chat_reads (room_id, user_id, last_read_at)
     VALUES (?, ?, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE last_read_at = CURRENT_TIMESTAMP(3)`,
    [roomId, userId],
  );
}

export async function sendMessage(
  roomId: string,
  actor: AuthPayload,
  text: string,
  imageUrl: string | null = null,
): Promise<ChatMessageDto> {
  await assertRoomExists(roomId);

  const message = text.trim();
  const image = imageUrl?.trim() || null;

  if (message.length === 0 && !image) {
    throw new HttpError(422, 'Сообщение не может быть пустым');
  }

  if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new HttpError(
      422,
      `Сообщение длиннее ${CHAT_MESSAGE_MAX_LENGTH} символов`,
    );
  }

  if (image && (image.length > 512 || (!image.startsWith('/') && !/^https?:\/\//i.test(image)))) {
    throw new HttpError(422, 'Некорректная ссылка на изображение');
  }

  const db = await getDb();
  const id = randomUUID();

  await db.query(
    `INSERT INTO chat_messages (id, room_id, user_id, user_login, message, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, roomId, actor.sub, actor.login, message, image],
  );

  // Автор сразу «прочитал» комнату, иначе своё же сообщение висело бы непрочитанным.
  await markRoomRead(roomId, actor.sub);

  const result = await db.query<ChatMessageRow>(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]);
  const row = result.rows[0];

  if (!row) {
    throw new HttpError(500, 'Не удалось сохранить сообщение');
  }

  const dto = toMessageDto(row);
  emitToAdmins('chat:message', { message: dto });

  return dto;
}
