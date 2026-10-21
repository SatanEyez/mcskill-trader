-- ── Уникальность импортированных предметов ───────────────────
-- В прайсе 9 252 видимых предмета, но 285 названий повторяются у разных
-- itemid/damage. Раньше resources.name был уникален, и импорт «схлопывал»
-- такие позиции. Теперь:
--   * ручные ресурсы (source_key IS NULL) по-прежнему уникальны по названию;
--   * импортированные — уникальны по source_key (itemid + damage).
ALTER TABLE resources
  ADD COLUMN source_key VARCHAR(200) NULL;

ALTER TABLE resources DROP INDEX resources_name_unique_idx;

-- MySQL не умеет частичные индексы: генерируемая колонка равна названию
-- только у ручных ресурсов, у импортированных она NULL. Уникальный индекс
-- допускает сколько угодно NULL, поэтому обе группы не мешают друг другу.
-- Колонка VIRTUAL, а не STORED: TiDB не умеет добавлять STORED-колонку
-- через ALTER TABLE, а VIRTUAL с уникальным индексом поддерживают обе СУБД.
ALTER TABLE resources
  ADD COLUMN name_manual_key VARCHAR(120)
    GENERATED ALWAYS AS (CASE WHEN source_key IS NULL THEN name ELSE NULL END) VIRTUAL;

CREATE UNIQUE INDEX resources_name_manual_unique_idx ON resources (name_manual_key);
CREATE UNIQUE INDEX resources_source_key_unique_idx ON resources (source_key);
