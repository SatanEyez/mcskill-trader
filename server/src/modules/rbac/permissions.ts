/**
 * Единый каталог прав RBAC.
 *
 * Ключи хранятся в admin_roles.permissions (JSONB-массив). Владелец получает
 * "*" и проходит любую проверку. Новые права добавляются только здесь,
 * чтобы сервер и интерфейс не расходились.
 */
export const PERMISSIONS = [
  { key: 'dashboard.view', group: 'Панель', label: 'Просмотр админ-панели' },
  { key: 'resources.read', group: 'Ресурсы', label: 'Просмотр ресурсов' },
  { key: 'resources.write', group: 'Ресурсы', label: 'Создание и редактирование ресурсов' },
  { key: 'resources.delete', group: 'Ресурсы', label: 'Удаление ресурсов' },
  { key: 'categories.read', group: 'Категории', label: 'Просмотр категорий' },
  { key: 'categories.write', group: 'Категории', label: 'Создание и редактирование категорий' },
  { key: 'users.read', group: 'Администраторы', label: 'Просмотр администраторов' },
  { key: 'users.write', group: 'Администраторы', label: 'Одобрение и отклонение заявок' },
  { key: 'users.delete', group: 'Администраторы', label: 'Удаление администраторов' },
  { key: 'users.roles', group: 'Администраторы', label: 'Назначение ролей и префиксов' },
  { key: 'roles.manage', group: 'Доступ', label: 'Управление ролями и правами' },
  { key: 'prefixes.manage', group: 'Доступ', label: 'Управление префиксами' },
  { key: 'import.run', group: 'Импорт', label: 'Массовый импорт прайса' },
  { key: 'news.write', group: 'Новости', label: 'Публикация новостей' },
  { key: 'stats.view', group: 'Панель', label: 'Статистика посещений' },
  { key: 'logs.read', group: 'Журнал', label: 'Просмотр журнала действий' },
  { key: 'support.read', group: 'Обращения', label: 'Просмотр обращений' },
  { key: 'support.write', group: 'Обращения', label: 'Ответы на обращения' },
  { key: 'presence.view', group: 'Панель', label: 'Список администраторов онлайн' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

/** Оставляет только известные ключи; защищает от мусора в JSONB. */
export function normalizePermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];

  const result: PermissionKey[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const key = entry.trim();
    if (key === '*') return ['*' as PermissionKey];
    if (PERMISSION_SET.has(key) && !result.includes(key as PermissionKey)) {
      result.push(key as PermissionKey);
    }
  }

  return result;
}

/** Проверка набора прав: "*" означает полный доступ. */
export function hasPermission(
  permissions: readonly string[] | null | undefined,
  required: PermissionKey,
): boolean {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export function canAll(
  permissions: readonly string[] | null | undefined,
  required: readonly PermissionKey[],
): boolean {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return required.every((key) => permissions.includes(key));
}
