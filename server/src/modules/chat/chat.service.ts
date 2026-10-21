import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import { emitToAdmins } from './chat.socket.js';
import type {
  ChatAccessLevelDto,
  ChatMessageDto,
  ChatMessageRow,
  ChatRoomDto,
  ChatRoomRow,
  ListMessagesQuery,
  RoomAccess,
} from './chat.types.js';

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_ROOM_NAME_MAX_LENGTH = 60;
export const CHAT_MAX_ACCESS_LEVEL = 1000;

/** Уровень доступа пользователя: чем больше, тем выше должность. */
const VIEWER_LEVEL_SQL = `
  COALESCE((
    SELECT rl.access_level
      FROM admin_roles AS rl
      JOIN admin_users AS u ON u.role_id = rl.id
     WHERE u.id = ?
  ), 0)
`;

const ROOM_SELECT = `
  SELECT r.id,
         r.name,
         r.created_by_login,
         r.created_at,
         r.access_level,
         r.prefix_level,
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
    access_level: Number(row.access_level ?? 0),
    prefix_level: Number(row.prefix_level ?? 0),
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

/** Префикс скрывается, если у зрителя не хватает доступа до порога комнаты. */
function toMessageDto(row: ChatMessageRow, hidePrefix = false): ChatMessageDto {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    user_login: row.user_login,
    avatar_url: row.avatar_url ?? null,
    user_prefix:
      !hidePrefix && row.prefix_name && row.prefix_color
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

/** Уровень доступа пользователя в цифрах (0 — роль без настроенного уровня). */
export async function getViewerLevel(userId: string): Promise<number> {
  const db = await getDb();
  const result = await db.query<{ level: number | string }>(
    `SELECT ${VIEWER_LEVEL_SQL} AS level`,
    [userId],
  );

  return Number(result.rows[0]?.level ?? 0);
}

/** Доступные уровни для выбора в интерфейсе: подпись — названия ролей этого уровня. */
export async function listAccessLevels(userId: string): Promise<{
  levels: ChatAccessLevelDto[];
  myLevel: number;
}> {
  const db = await getDb();
  const result = await db.query<{ access_level: number | string; names: string | null }>(
    `SELECT access_level,
            GROUP_CONCAT(name ORDER BY name SEPARATOR ' / ') AS names
       FROM admin_roles
      GROUP BY access_level
      ORDER BY access_level DESC`,
  );

  const levels: ChatAccessLevelDto[] = result.rows.map((row) => ({
    level: Number(row.access_level),
    label: row.names ?? `Уровень ${row.access_level}`,
  }));

  // Базовый уровень «все с доступом к чату» есть всегда, даже если ролей с 0 нет.
  if (!levels.some((entry) => entry.level === 0)) {
    levels.push({ level: 0, label: 'Все с доступом к чату' });
  } else {
    const base = levels.find((entry) => entry.level === 0);
    if (base) base.label = `Все с доступом к чату · ${base.label}`;
  }

  return { levels, myLevel: await getViewerLevel(userId) };
}

/** Все комнаты, доступные пользователю по его уровню доступа. */
export async function listRooms(userId: string): Promise<ChatRoomDto[]> {
  const db = await getDb();
  const result = await db.query<ChatRoomRow>(
    `${ROOM_SELECT}
      WHERE r.access_level <= ${VIEWER_LEVEL_SQL}
      ORDER BY COALESCE(last_message_at, r.created_at) DESC, r.name ASC`,
    [userId, userId, userId],
  );

  return result.rows.map(toRoomDto);
}

/**
 * Проверяет, что комната существует и доступна пользователю.
 * Недоступная комната отвечает 404 — чтобы не раскрывать её существование.
 */
async function loadRoomAccess(roomId: string, userId: string): Promise<RoomAccess> {
  const db = await getDb();
  const result = await db.query<{
    id: string;
    access_level: number | string;
    prefix_level: number | string;
    viewer_level: number | string;
  }>(
    `SELECT r.id,
            r.access_level,
            r.prefix_level,
            ${VIEWER_LEVEL_SQL} AS viewer_level
       FROM chat_rooms AS r
      WHERE r.id = ?`,
    [userId, roomId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new HttpError(404, 'Комната не найдена');
  }

  const access: RoomAccess = {
    accessLevel: Number(row.access_level ?? 0),
    prefixLevel: Number(row.prefix_level ?? 0),
    viewerLevel: Number(row.viewer_level ?? 0),
  };

  if (access.viewerLevel < access.accessLevel) {
    throw new HttpError(404, 'Комната не найдена');
  }

  return access;
}

export async function getRoom(roomId: string, userId: string): Promise<ChatRoomDto> {
  await loadRoomAccess(roomId, userId);

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

export async function createRoom(
  name: string,
  accessLevel: number,
  prefixLevel: number,
  actor: AuthPayload,
): Promise<ChatRoomDto> {
  const db = await getDb();
  const trimmed = name.trim();
  const actorLevel = await getViewerLevel(actor.sub);

  if (accessLevel > actorLevel) {
    throw new HttpError(422, 'Нельзя создать комнату с доступом выше вашего собственного');
  }

  if (prefixLevel > actorLevel) {
    throw new HttpError(422, 'Нельзя скрыть префиксы от собственного уровня доступа');
  }

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM chat_rooms WHERE LOWER(name) = LOWER(?)',
    [trimmed],
  );

  if (duplicate.rows.length > 0) {
    throw new HttpError(409, 'Комната с таким названием уже существует');
  }

  const id = randomUUID();

  await db.query(
    `INSERT INTO chat_rooms (id, name, created_by, created_by_login, access_level, prefix_level)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, trimmed, actor.sub, actor.login, accessLevel, prefixLevel],
  );

  const room: ChatRoomDto = {
    id,
    name: trimmed,
    created_by_login: actor.login,
    created_at: new Date().toISOString(),
    access_level: accessLevel,
    prefix_level: prefixLevel,
    unread_count: 0,
    last_message: null,
  };

  emitToAdmins('chat:room', { room });

  return room;
}

/** История сообщений: порция «до» указанного времени, от старых к новым. */
export async function listMessages(
  roomId: string,
  userId: string,
  query: ListMessagesQuery,
): Promise<ChatMessageDto[]> {
  const access = await loadRoomAccess(roomId, userId);

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

  const hidePrefix = access.viewerLevel < access.prefixLevel;

  return result.rows.reverse().map((row) => toMessageDto(row, hidePrefix));
}

/** UPSERT отметки прочтения: чат считается прочитанным до этого момента. */
export async function markRoomRead(roomId: string, userId: string): Promise<void> {
  await loadRoomAccess(roomId, userId);
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
  const access = await loadRoomAccess(roomId, actor.sub);

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

  const dto = toMessageDto(row, access.viewerLevel < access.prefixLevel);
  // В рассылку префикс уходит всегда: каждый клиент сам скрывает его, если его
  // доступ ниже порога комнаты (порог известен из списка комнат).
  emitToAdmins('chat:message', { message: toMessageDto(row) });

  return dto;
}
