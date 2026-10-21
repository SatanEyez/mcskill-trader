-- Уровни доступа: чем больше число, тем выше должность.
-- Используются служебным чатом, чтобы ограничивать видимость комнат и префиксов.
ALTER TABLE admin_roles ADD COLUMN access_level INT NOT NULL DEFAULT 10;

UPDATE admin_roles SET access_level = 100 WHERE code = 'owner';
UPDATE admin_roles SET access_level = 80 WHERE code = 'administrator';
UPDATE admin_roles SET access_level = 60 WHERE code = 'moderator';
UPDATE admin_roles SET access_level = 40 WHERE code = 'support';
UPDATE admin_roles SET access_level = 20 WHERE code = 'chat_stajer';

-- Комната: access_level — минимальный уровень доступа, который её видит
-- (0 — все, у кого есть право chat.use), prefix_level — с какого уровня
-- в комнате показываются префиксы авторов (0 — всем участникам комнаты).
ALTER TABLE chat_rooms ADD COLUMN access_level INT NOT NULL DEFAULT 0;
ALTER TABLE chat_rooms ADD COLUMN prefix_level INT NOT NULL DEFAULT 0;

-- Создание комнат — отдельное право, чтобы выдавать его точечно.
-- Владелец проходит проверку через "*".
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'chat.create')
 WHERE code = 'administrator'
   AND JSON_CONTAINS(permissions, '"chat.create"') = 0;
