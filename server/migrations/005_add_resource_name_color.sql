BEGIN;

-- ── Цвет названия предмета ───────────────────────────────────
-- HEX-цвет из Minecraft-кодов форматирования (#RRGGBB).
-- NULL — название рисуется обычным цветом темы (демо-данные и старые строки).
ALTER TABLE resources ADD COLUMN IF NOT EXISTS name_color TEXT;

COMMIT;
