-- ── Настройки сайта ─────────────────────────────────────────
-- Небольшое key/value-хранилище для публичных переключателей оформления.
-- Значения храним в JSON: booleans, числа и строки без отдельных колонок.
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value JSON NOT NULL,
  updated_by_login VARCHAR(32) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Хэллоуин включаем по умолчанию: сезонное оформление должно появиться
-- сразу после обновления, а выключить его можно в админке одним кликом.
INSERT IGNORE INTO site_settings (setting_key, setting_value)
VALUES ('halloween_enabled', 'true');

-- ── Новое право ─────────────────────────────────────────────
-- Владелец имеет "*" и получает доступ автоматически. Администраторам
-- выдаём право на оформление, чтобы они могли управлять сезонным режимом.
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'settings.manage')
 WHERE code = 'administrator'
   AND NOT JSON_CONTAINS(permissions, '"settings.manage"');
