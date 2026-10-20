BEGIN;

-- ── Администраторы ───────────────────────────────────────────
-- Регистрация по логину/паролю. Доступ выдаётся только после
-- одобрения действующим администратором (status = 'approved').
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY,
  login VARCHAR(32) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'admin',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  last_login_at TIMESTAMPTZ
);

-- Логины уникальны без учёта регистра.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_login_unique_idx
  ON admin_users (LOWER(login));

CREATE INDEX IF NOT EXISTS admin_users_status_idx
  ON admin_users (status);

DO $$
BEGIN
  ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('owner', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES admin_users (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Журнал действий ──────────────────────────────────────────
-- Пишется на каждое изменение каталога, управление администраторами
-- и попытки входа. Время хранится в UTC, клиент показывает по МСК.
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  user_login VARCHAR(32) NOT NULL,
  action VARCHAR(48) NOT NULL,
  entity_type VARCHAR(24),
  entity_id TEXT,
  entity_label TEXT,
  details JSONB,
  ip VARCHAR(64),
  user_agent VARCHAR(255)
);

-- Удаление администратора не стирает историю: остаётся логин и действие.
DO $$
BEGIN
  ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON audit_log (action);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx
  ON audit_log (user_id);

COMMIT;
