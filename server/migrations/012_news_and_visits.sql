-- ── Новости сайта ────────────────────────────────────────────
-- Лента публичных новостей: пишется из админки, читается всеми.
CREATE TABLE IF NOT EXISTS news_posts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(160) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  image_url VARCHAR(512) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_by_login VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY news_posts_published_idx (is_published, published_at),
  KEY news_posts_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Посещения сайта ──────────────────────────────────────────
-- Одна строка = один просмотр страницы. Уникальность посетителя
-- считается по visitor_id (долгоживущая cookie), поэтому «разные люди»
-- не схлопываются в один счётчик.
CREATE TABLE IF NOT EXISTS site_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visitor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  path VARCHAR(255) NOT NULL,
  referrer VARCHAR(255) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY site_visits_created_idx (created_at),
  KEY site_visits_visitor_idx (visitor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Новые права ──────────────────────────────────────────────
-- Владелец имеет "*" и получает доступ автоматически. Остальным ролям
-- выдаём ключи здесь: иначе после обновления разделы были бы недоступны.
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'news.write')
 WHERE code IN ('administrator', 'moderator')
   AND NOT JSON_CONTAINS(permissions, '"news.write"');

UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'stats.view')
 WHERE code = 'administrator'
   AND NOT JSON_CONTAINS(permissions, '"stats.view"');
