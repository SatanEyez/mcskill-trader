-- ── Администраторы ───────────────────────────────────────────
-- Регистрация по логину/паролю. Доступ выдаётся только после
-- одобрения действующим администратором (status = 'approved').
CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  login VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'admin',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_at DATETIME(3) NULL,
  reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  last_login_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  -- Логины уникальны без учёта регистра (collation *_ai_ci).
  UNIQUE KEY admin_users_login_unique_idx (login),
  KEY admin_users_status_idx (status),
  CONSTRAINT admin_users_role_check CHECK (role IN ('owner', 'admin')),
  CONSTRAINT admin_users_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT admin_users_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Журнал действий ──────────────────────────────────────────
-- Пишется на каждое изменение каталога, управление администраторами
-- и попытки входа. Время хранится в UTC, клиент показывает по МСК.
CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_login VARCHAR(32) NOT NULL,
  action VARCHAR(48) NOT NULL,
  entity_type VARCHAR(24) NULL,
  entity_id TEXT NULL,
  entity_label TEXT NULL,
  details JSON NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  -- Удаление администратора не стирает историю: остаётся логин и действие.
  CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action);
CREATE INDEX audit_log_user_id_idx ON audit_log (user_id);
