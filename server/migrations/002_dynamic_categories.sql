-- Динамические категории: отдельная таблица вместо строки в resources.
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(60) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- Названия категорий уникальны без учёта регистра (collation *_ai_ci).
  UNIQUE KEY categories_name_unique_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Ссылка на категорию. NULL означает «Без категории».
ALTER TABLE resources
  ADD COLUMN category_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Переносим существующие строковые категории в новую таблицу.
INSERT IGNORE INTO categories (id, name)
SELECT UUID(), MIN(category)
  FROM resources
 WHERE category IS NOT NULL AND TRIM(category) <> ''
 GROUP BY LOWER(category);

UPDATE resources AS r
  JOIN categories AS c ON LOWER(r.category) = LOWER(c.name)
   SET r.category_id = c.id
 WHERE r.category_id IS NULL;

-- Внешний ключ: при удалении категории ресурсы остаются, но без категории.
ALTER TABLE resources
  ADD CONSTRAINT resources_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;

CREATE INDEX resources_category_id_idx ON resources (category_id);

-- Старое строковое поле больше не нужно.
ALTER TABLE resources DROP COLUMN category;
