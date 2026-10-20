BEGIN;

-- ── Уникальность импортированных предметов ───────────────────
-- В прайсе 9 252 видимых предмета, но 285 названий повторяются у разных
-- itemid/damage. Раньше resources.name был уникален, и импорт «схлопывал»
-- такие позиции. Теперь:
--   * ручные ресурсы (source_key IS NULL) по-прежнему уникальны по названию;
--   * импортированные — уникальны по source_key (itemid + damage).
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_key VARCHAR(200);

DROP INDEX IF EXISTS resources_name_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS resources_name_manual_unique_idx
  ON resources (LOWER(name))
  WHERE source_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS resources_source_key_unique_idx
  ON resources (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS resources_source_key_idx
  ON resources (source_key);

COMMIT;
