-- ── Кто одобрил / отклонил заявку ───────────────────────────
-- Логин ревьюера храним снимком: reviewed_by — ссылка на admin_users,
-- и после удаления администратора она обнуляется. Без снимка в списке
-- оставалось бы «одобрено» без имени.
ALTER TABLE admin_users
  ADD COLUMN reviewed_by_login VARCHAR(32) NULL;

-- Разовые данные для уже принятых заявок.
UPDATE admin_users AS u
  JOIN admin_users AS reviewer ON reviewer.id = u.reviewed_by
   SET u.reviewed_by_login = reviewer.login
 WHERE u.reviewed_by_login IS NULL;
