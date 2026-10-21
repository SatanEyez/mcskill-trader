-- Учёт времени в сети для администрации.
-- online_seconds — накопленное время (секунды) за все сессии;
-- session_started_at — начало текущей непрерывной сессии (для «онлайн сейчас»).
ALTER TABLE admin_users
  ADD COLUMN online_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN session_started_at DATETIME(3) NULL;
