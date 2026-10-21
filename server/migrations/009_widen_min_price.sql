-- Цена предмета: в редакторе теперь можно ввести до 24 символов.
-- DECIMAL(24, 2) вмещает 22 цифры до запятой — с запасом под такой ввод.
ALTER TABLE resources
  MODIFY COLUMN min_price DECIMAL(24, 2) NOT NULL;
