-- ── Аватар администратора ────────────────────────────────────
-- Сам файл лежит в uploaded_files (база переживает деплой), здесь — ссылка.
ALTER TABLE admin_users
  ADD COLUMN avatar_url VARCHAR(512) NOT NULL DEFAULT '';

-- ── Файлы, загруженные через админку ─────────────────────────
-- Раньше они лежали в server/uploads и исчезали при передеплое Render
-- (файловая система контейнера эфемерная). Теперь тело файла — в базе.
CREATE TABLE IF NOT EXISTS uploaded_files (
  name VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime VARCHAR(32) NOT NULL,
  size INT NOT NULL,
  data MEDIUMBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Отдельное право на удаление администраторов ──────────────
-- Раньше удаление входило в users.write; ролям, у которых оно было,
-- выдаём новый ключ, чтобы они не потеряли доступ.
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'users.delete')
 WHERE JSON_CONTAINS(permissions, '"users.write"')
   AND NOT JSON_CONTAINS(permissions, '"users.delete"');
