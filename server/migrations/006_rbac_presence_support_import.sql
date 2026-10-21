-- ── RBAC: роли и права ───────────────────────────────────────
-- Гибкие роли вместо жёсткой пары owner/admin. Колонка admin_users.role
-- остаётся для обратной совместимости и быстрых проверок «владелец/нет».
CREATE TABLE IF NOT EXISTS admin_roles (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(60) NOT NULL,
  description TEXT NULL,
  permissions JSON NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY admin_roles_code_unique_idx (code),
  UNIQUE KEY admin_roles_name_unique_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Префиксы администраторов ─────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_prefixes (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#34D399',
  priority INT NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY admin_prefixes_name_unique_idx (name),
  CONSTRAINT admin_prefixes_color_check CHECK (REGEXP_LIKE(color, '^#[0-9A-Fa-f]{6}$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Связи администратора с ролью и префиксом ─────────────────
ALTER TABLE admin_users
  ADD COLUMN role_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN prefix_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN last_seen_at DATETIME(3) NULL,
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN discord VARCHAR(64) NULL;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE SET NULL,
  ADD CONSTRAINT admin_users_prefix_id_fkey
    FOREIGN KEY (prefix_id) REFERENCES admin_prefixes (id) ON DELETE SET NULL;

CREATE INDEX admin_users_last_seen_idx ON admin_users (last_seen_at DESC);

-- ── Начальные роли ───────────────────────────────────────────
-- Владелец имеет "*" — все проверки прав проходят автоматически.
INSERT IGNORE INTO admin_roles (id, code, name, description, permissions, is_system) VALUES
  (UUID(), 'owner', 'Владелец',
   'Полный доступ ко всем разделам и настройкам.',
   '["*"]', TRUE),
  (UUID(), 'administrator', 'Администратор',
   'Каталог, категории, обращения и журнал действий.',
   '["dashboard.view","resources.read","resources.write","resources.delete","categories.read","categories.write","users.read","logs.read","support.read","support.write","presence.view"]',
   TRUE),
  (UUID(), 'moderator', 'Модератор',
   'Правка каталога и работа с обращениями без удаления ресурсов.',
   '["dashboard.view","resources.read","resources.write","categories.read","logs.read","support.read","support.write"]',
   TRUE),
  (UUID(), 'support', 'Поддержка',
   'Просмотр каталога и ответы на обращения пользователей.',
   '["dashboard.view","resources.read","categories.read","logs.read","support.read","support.write"]',
   TRUE);

-- ── Начальные префиксы ───────────────────────────────────────
INSERT IGNORE INTO admin_prefixes (id, name, color, priority, is_system) VALUES
  (UUID(), 'Владелец', '#F5C542', 100, TRUE),
  (UUID(), 'Администратор', '#34D399', 80, TRUE),
  (UUID(), 'Модератор', '#38BDF8', 60, TRUE),
  (UUID(), 'Поддержка', '#C084FC', 40, TRUE),
  (UUID(), 'Синхронизация', '#94A3B8', 0, TRUE);

-- ── Привязка существующих администраторов ────────────────────
UPDATE admin_users AS u
  JOIN admin_roles AS r
    ON (u.role = 'owner' AND r.code = 'owner')
    OR (u.role <> 'owner' AND r.code = 'administrator')
   SET u.role_id = r.id
 WHERE u.role_id IS NULL;

UPDATE admin_users AS u
  JOIN admin_prefixes AS p
    ON (u.role = 'owner' AND p.name = 'Владелец')
    OR (u.role <> 'owner' AND p.name = 'Администратор')
   SET u.prefix_id = p.id
 WHERE u.prefix_id IS NULL;

-- ── Системный актор импорта ──────────────────────────────────
-- Все массовые операции пишутся в журнал от имени synced_.
-- Пароль недоступен: hash '!' заведомо не проходит проверку scrypt.
INSERT IGNORE INTO admin_users
  (id, login, password_hash, role, status, is_system, role_id, prefix_id,
   reviewed_at, reviewed_by_login)
SELECT UUID(), 'synced_', '!', 'admin', 'approved', TRUE, r.id, p.id,
       CURRENT_TIMESTAMP(3), 'system'
  FROM admin_roles AS r
  JOIN admin_prefixes AS p ON p.name = 'Синхронизация'
 WHERE r.code = 'administrator';

-- ── Категории: описание и цвет (расширенный редактор) ────────
ALTER TABLE categories
  ADD COLUMN description TEXT NULL,
  ADD COLUMN color VARCHAR(7) NULL;

-- ── История импортов ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_login VARCHAR(32) NOT NULL DEFAULT 'synced_',
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  source_name VARCHAR(255) NULL,
  total_items INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  image_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  errors JSON NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT import_jobs_status_check CHECK (status IN ('running', 'done', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE INDEX import_jobs_started_at_idx ON import_jobs (started_at DESC);

-- ── Обращения пользователей (репорты и поддержка) ────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ticket_no BIGINT NOT NULL AUTO_INCREMENT,
  kind VARCHAR(16) NOT NULL,
  nick VARCHAR(64) NOT NULL,
  discord VARCHAR(64) NOT NULL,
  target VARCHAR(160) NULL,
  message TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  admin_reply TEXT NULL,
  replied_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  replied_by_login VARCHAR(32) NULL,
  replied_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY support_tickets_no_unique_idx (ticket_no),
  CONSTRAINT support_tickets_kind_check CHECK (kind IN ('item', 'player', 'price', 'error', 'other')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('new', 'in_progress', 'answered', 'closed')),
  CONSTRAINT support_tickets_replied_by_fkey
    FOREIGN KEY (replied_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE INDEX support_tickets_status_idx ON support_tickets (status, created_at DESC);
CREATE INDEX support_tickets_created_at_idx ON support_tickets (created_at DESC);
