-- ── Иконки прайса в базе ─────────────────────────────────────
-- Иконки из git отдаются статикой (быстро и без запросов к базе),
-- а сюда попадают иконки, загруженные импортом: диск контейнера на
-- Render пересоздаётся при каждом деплое.
CREATE TABLE IF NOT EXISTS price_icons (
  name VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  data MEDIUMBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Стоп-лист импорта ────────────────────────────────────────
-- Удалённый через админку предмет не возвращается следующим импортом.
-- Данные предмета храним, чтобы вернуть его одной кнопкой.
CREATE TABLE IF NOT EXISTS import_exclusions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_key VARCHAR(200) NULL,
  name_key VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  min_price DECIMAL(24,2) NOT NULL,
  image_url VARCHAR(512) NOT NULL DEFAULT '',
  name_color VARCHAR(7) NULL,
  category_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_by_login VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY import_exclusions_source_unique_idx (source_key),
  KEY import_exclusions_name_idx (name_key),
  KEY import_exclusions_created_idx (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
