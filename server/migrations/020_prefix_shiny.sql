-- «Shiny»-эффект префикса: по тексту пробегает светлая полоса (как у
-- блестящих покемонов в Pixelmon). Сама анимация — в CSS (.prefix-shiny),
-- в базе хранится только флаг.
ALTER TABLE admin_prefixes
  ADD COLUMN is_shiny TINYINT(1) NOT NULL DEFAULT 0;
