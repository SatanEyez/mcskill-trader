BEGIN;

-- Динамические категории: отдельная таблица вместо строки в resources.
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Названия категорий уникальны без учёта регистра.
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx
  ON categories (LOWER(name));

-- Ссылка на категорию. NULL означает «Без категории».
ALTER TABLE resources ADD COLUMN IF NOT EXISTS category_id UUID;

-- Переносим существующие строковые категории в новую таблицу.
INSERT INTO categories (id, name)
SELECT gen_random_uuid(), MIN(category)
  FROM resources
 WHERE category IS NOT NULL AND btrim(category) <> ''
 GROUP BY LOWER(category)
ON CONFLICT DO NOTHING;

UPDATE resources AS r
   SET category_id = c.id
  FROM categories AS c
 WHERE r.category_id IS NULL
   AND LOWER(r.category) = LOWER(c.name);

-- Внешний ключ: при удалении категории ресурсы остаются, но без категории.
DO $$
BEGIN
  ALTER TABLE resources
    ADD CONSTRAINT resources_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS resources_category_id_idx
  ON resources (category_id);

-- Старое строковое поле больше не нужно.
ALTER TABLE resources DROP COLUMN IF EXISTS category;

COMMIT;
