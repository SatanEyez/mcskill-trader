-- Управление комнатами служебного чата: аватар, переименование, удаление.
-- Аватар — та же ссылка, что и у сообщений: /uploads/... либо http(s).
ALTER TABLE chat_rooms ADD COLUMN avatar_url VARCHAR(512) NULL;

-- Изменение комнаты (название, аватар) — отдельное право от создания.
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'chat.edit')
 WHERE code = 'administrator'
   AND JSON_CONTAINS(permissions, '"chat.edit"') = 0;

-- Удаление комнаты — самое опасное действие, поэтому тоже отдельный ключ.
-- Владелец проходит проверку через "*"; остальным ролям право выдаётся вручную
-- в разделе «Доступ».
UPDATE admin_roles
   SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'chat.delete')
 WHERE code = 'administrator'
   AND JSON_CONTAINS(permissions, '"chat.delete"') = 0;
