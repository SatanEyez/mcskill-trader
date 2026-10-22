import type { AdminPrefix, AdminRole } from '../types';

/**
 * Префикс важнее роли: если он есть, роль рядом с логином не показываем.
 * Иначе у владельца с префиксом «ВЛАДЕЛЕЦ» на одном экране два раза написано
 * одно и то же — бейдж префикса и подпись роли.
 *
 * Нет префикса — значит единственный опознавательный знак это роль, её и рисуем.
 */
export function showsRole(prefix: AdminPrefix | null | undefined): boolean {
  return !prefix;
}

/**
 * Подпись роли: своё название из БД, если оно задано, иначе базовое.
 * Нужна там, где роль показывается без бейджа префикса.
 */
export function roleLabelOf(
  roleName?: string | null,
  role?: AdminRole | null,
): string {
  const custom = roleName?.trim();

  if (custom) return custom;

  return role === 'owner' ? 'Владелец' : 'Администратор';
}
