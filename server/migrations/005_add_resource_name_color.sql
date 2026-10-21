-- ── Цвет названия предмета ───────────────────────────────────
-- HEX-цвет из Minecraft-кодов форматирования (#RRGGBB).
-- NULL — название рисуется обычным цветом темы (демо-данные и старые строки).
ALTER TABLE resources
  ADD COLUMN name_color VARCHAR(7) NULL;
