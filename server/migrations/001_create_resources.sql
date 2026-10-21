CREATE TABLE IF NOT EXISTS resources (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  min_price DECIMAL(18, 2) NOT NULL,
  image_url VARCHAR(512) NOT NULL DEFAULT '',
  category VARCHAR(60) NOT NULL DEFAULT 'Разное',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- Сравнение по умолчанию регистронезависимое (utf8mb4_0900_ai_ci),
  -- поэтому названия уникальны без учёта регистра.
  UNIQUE KEY resources_name_unique_idx (name),
  KEY resources_category_idx (category),
  KEY resources_price_idx (min_price),
  CONSTRAINT resources_min_price_check CHECK (min_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
