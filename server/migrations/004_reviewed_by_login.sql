BEGIN;

-- ── Кто одобрил / отклонил заявку ───────────────────────────
-- Логин ревьюера храним снимком: reviewed_by — ссылка на admin_users,
-- и после удаления администратора она обнуляется. Без снимка в списке
-- оставалось бы «одобрено» без имени.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS reviewed_by_login VARCHAR(32);

-- Разовые данные для уже принятых заявок.
UPDATE admin_users AS u
   SET reviewed_by_login = reviewer.login
  FROM admin_users AS reviewer
 WHERE u.reviewed_by = reviewer.id
   AND u.reviewed_by_login IS NULL;

COMMIT;
