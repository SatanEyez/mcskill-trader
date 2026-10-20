BEGIN;

-- ── RBAC: роли и права ───────────────────────────────────────
-- Гибкие роли вместо жёсткой пары owner/admin. Колонка admin_users.role
-- остаётся для обратной совместимости и быстрых проверок «владелец/нет».
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(60) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_code_unique_idx
  ON admin_roles (LOWER(code));

CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_name_unique_idx
  ON admin_roles (LOWER(name));

-- ── Префиксы администраторов ─────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_prefixes (
  id UUID PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#34D399',
  priority INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_prefixes_name_unique_idx
  ON admin_prefixes (LOWER(name));

DO $$
BEGIN
  ALTER TABLE admin_prefixes
    ADD CONSTRAINT admin_prefixes_color_check
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Связи администратора с ролью и префиксом ─────────────────
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role_id UUID;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS prefix_id UUID;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS discord VARCHAR(64);

DO $$
BEGIN
  ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_prefix_id_fkey
    FOREIGN KEY (prefix_id) REFERENCES admin_prefixes (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS admin_users_last_seen_idx
  ON admin_users (last_seen_at DESC);

-- ── Начальные роли ───────────────────────────────────────────
-- Владелец имеет "*" — все проверки прав проходят автоматически.
INSERT INTO admin_roles (id, code, name, description, permissions, is_system)
SELECT gen_random_uuid(), 'owner', 'Владелец',
       'Полный доступ ко всем разделам и настройкам.',
       '["*"]'::jsonb, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE LOWER(code) = 'owner');

INSERT INTO admin_roles (id, code, name, description, permissions, is_system)
SELECT gen_random_uuid(), 'administrator', 'Администратор',
       'Каталог, категории, обращения и журнал действий.',
       '["dashboard.view","resources.read","resources.write","resources.delete","categories.read","categories.write","users.read","logs.read","support.read","support.write","presence.view"]'::jsonb,
       TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE LOWER(code) = 'administrator');

INSERT INTO admin_roles (id, code, name, description, permissions, is_system)
SELECT gen_random_uuid(), 'moderator', 'Модератор',
       'Правка каталога и работа с обращениями без удаления ресурсов.',
       '["dashboard.view","resources.read","resources.write","categories.read","logs.read","support.read","support.write"]'::jsonb,
       TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE LOWER(code) = 'moderator');

INSERT INTO admin_roles (id, code, name, description, permissions, is_system)
SELECT gen_random_uuid(), 'support', 'Поддержка',
       'Просмотр каталога и ответы на обращения пользователей.',
       '["dashboard.view","resources.read","categories.read","logs.read","support.read","support.write"]'::jsonb,
       TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE LOWER(code) = 'support');

-- ── Начальные префиксы ───────────────────────────────────────
INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT gen_random_uuid(), 'Владелец', '#F5C542', 100, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE LOWER(name) = 'владелец');

INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT gen_random_uuid(), 'Администратор', '#34D399', 80, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE LOWER(name) = 'администратор');

INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT gen_random_uuid(), 'Модератор', '#38BDF8', 60, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE LOWER(name) = 'модератор');

INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT gen_random_uuid(), 'Поддержка', '#C084FC', 40, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE LOWER(name) = 'поддержка');

INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT gen_random_uuid(), 'Синхронизация', '#94A3B8', 0, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE LOWER(name) = 'синхронизация');

-- ── Привязка существующих администраторов ────────────────────
UPDATE admin_users AS u
   SET role_id = r.id
  FROM admin_roles AS r
 WHERE u.role_id IS NULL
   AND ((u.role = 'owner' AND r.code = 'owner')
     OR (u.role <> 'owner' AND r.code = 'administrator'));

UPDATE admin_users AS u
   SET prefix_id = p.id
  FROM admin_prefixes AS p
 WHERE u.prefix_id IS NULL
   AND ((u.role = 'owner' AND p.name = 'Владелец')
     OR (u.role <> 'owner' AND p.name = 'Администратор'));

-- ── Системный актор импорта ──────────────────────────────────
-- Все массовые операции пишутся в журнал от имени synced_.
-- Пароль недоступен: hash '!' заведомо не проходит проверку scrypt.
INSERT INTO admin_users
  (id, login, password_hash, role, status, is_system, role_id, prefix_id,
   reviewed_at, reviewed_by_login)
SELECT gen_random_uuid(), 'synced_', '!', 'admin', 'approved', TRUE, r.id, p.id,
       NOW(), 'system'
  FROM admin_roles AS r, admin_prefixes AS p
 WHERE r.code = 'administrator'
   AND p.name = 'Синхронизация'
   AND NOT EXISTS (SELECT 1 FROM admin_users WHERE LOWER(login) = 'synced_');

-- ── Категории: описание и цвет (расширенный редактор) ────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- ── История импортов ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY,
  actor_login VARCHAR(32) NOT NULL DEFAULT 'synced_',
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  source_name TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

DO $$
BEGIN
  ALTER TABLE import_jobs
    ADD CONSTRAINT import_jobs_status_check
    CHECK (status IN ('running', 'done', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS import_jobs_started_at_idx
  ON import_jobs (started_at DESC);

-- ── Обращения пользователей (репорты и поддержка) ────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  ticket_no BIGSERIAL,
  kind VARCHAR(16) NOT NULL,
  nick VARCHAR(64) NOT NULL,
  discord VARCHAR(64) NOT NULL,
  target VARCHAR(160),
  message TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  admin_reply TEXT,
  replied_by UUID,
  replied_by_login VARCHAR(32),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip VARCHAR(64),
  user_agent VARCHAR(255)
);

DO $$
BEGIN
  ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_kind_check
    CHECK (kind IN ('item', 'player', 'price', 'error', 'other'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_status_check
    CHECK (status IN ('new', 'in_progress', 'answered', 'closed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_replied_by_fkey
    FOREIGN KEY (replied_by) REFERENCES admin_users (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_no_unique_idx
  ON support_tickets (ticket_no);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx
  ON support_tickets (created_at DESC);

COMMIT;
