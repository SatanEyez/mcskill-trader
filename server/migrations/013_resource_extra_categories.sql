-- Дополнительные категории ресурса: предмет может показываться сразу в нескольких
-- категориях каталога. Основная категория остаётся в resources.category_id
-- (её видят карточка, импорт и стоп-лист), а здесь лежат только дополнительные.
CREATE TABLE IF NOT EXISTS resource_categories (
  resource_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (resource_id, category_id),
  KEY resource_categories_category_idx (category_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
