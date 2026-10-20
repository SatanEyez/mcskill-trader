CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  min_price NUMERIC(18, 2) NOT NULL CHECK (min_price > 0),
  image_url TEXT NOT NULL DEFAULT '',
  category VARCHAR(60) NOT NULL DEFAULT 'Разное',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Названия предметов не должны дублироваться (без учёта регистра).
CREATE UNIQUE INDEX IF NOT EXISTS resources_name_unique_idx
  ON resources (LOWER(name));

CREATE INDEX IF NOT EXISTS resources_category_idx
  ON resources (category);

CREATE INDEX IF NOT EXISTS resources_price_idx
  ON resources (min_price);
