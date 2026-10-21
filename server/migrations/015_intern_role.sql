-- Роль «Стажёр» для автоматической выдачи при одобрении доступа.
-- Роль могла быть создана вручную через интерфейс — тогда ничего не меняем.
INSERT INTO admin_roles (id, code, name, description, permissions, is_system)
SELECT UUID(),
       'chat_stajer',
       'Стажёр',
       'Новый сотрудник: просмотр панели, обращений и списка администрации',
       JSON_ARRAY('presence.view', 'dashboard.view', 'users.read', 'support.read', 'support.write'),
       0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE code = 'chat_stajer');

-- Отдельный префикс, чтобы стажёр не выглядел как администратор.
INSERT INTO admin_prefixes (id, name, color, priority, is_system)
SELECT UUID(), 'Стажёр', '#FBBF24', 30, 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_prefixes WHERE name = 'Стажёр');
