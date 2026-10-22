-- ── Тема оформления сайта ───────────────────────────────────
-- Раньше был один флаг `halloween_enabled`. Теперь тем несколько и активна
-- ровно одна, поэтому храним ключ `theme`: default | halloween | newyear.
--
-- Флаг `halloween_enabled` остаётся в API для совместимости со старыми
-- сборками и вычисляется из темы; в базе источником истины больше не является.
INSERT IGNORE INTO site_settings (setting_key, setting_value)
SELECT 'theme',
       CASE
         WHEN JSON_UNQUOTE(setting_value) IN ('true', '1') THEN JSON_QUOTE('halloween')
         ELSE JSON_QUOTE('default')
       END
  FROM site_settings
 WHERE setting_key = 'halloween_enabled';

-- Страховка: если строки halloween_enabled почему-то нет, тема всё равно
-- должна существовать, иначе первый GET вернёт пустоту.
INSERT IGNORE INTO site_settings (setting_key, setting_value)
VALUES ('theme', JSON_QUOTE('default'));
