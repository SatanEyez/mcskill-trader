-- Служебный чат администраторов: комнаты, сообщения, отметки прочтения.
CREATE TABLE IF NOT EXISTS chat_rooms (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_by_login VARCHAR(60) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  room_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_login VARCHAR(60) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY chat_messages_room_idx (room_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS chat_reads (
  room_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  last_read_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (room_id, user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Право на чат: владелец проходит через "*", остальным ролям выдаём явно.
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'chat.use')
 WHERE code IN ('administrator', 'moderator', 'support', 'chat_stajer')
   AND JSON_CONTAINS(permissions, '"chat.use"') = 0;

-- Стартовая комната, чтобы чат не был пустым при первом открытии.
INSERT INTO chat_rooms (id, name, created_by, created_by_login)
SELECT UUID(), 'Общий чат', NULL, 'system'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM chat_rooms);
