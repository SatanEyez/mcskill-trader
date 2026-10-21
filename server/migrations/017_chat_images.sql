-- Фото в сообщениях служебного чата (ссылка на /uploads/<uuid>.png).
ALTER TABLE chat_messages ADD COLUMN image_url VARCHAR(512) NULL;
