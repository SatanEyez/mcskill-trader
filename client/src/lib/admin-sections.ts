import {
  BarChart3,
  Boxes,
  MessageSquareWarning,
  MessagesSquare,
  Newspaper,
  Palette,
  ScrollText,
  ShieldCheck,
  Tags,
  Upload,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { AdminRoleInfo } from '../types';

/**
 * Каталог разделов админки.
 *
 * Один список на всё: строка вкладок под шапкой и страница «Панель управления».
 * Право доступа берётся из RBAC, уровень — минимальный уровень среди ролей,
 * которым это право выдано.
 */
export interface AdminSection {
  key: string;
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  permission: string;
  /** Достаточно любого из двух прав. */
  anyPermission?: string;
  /** Дублируется в строке вкладок под шапкой. */
  inTabs: boolean;
  /** Группа карточек на странице «Панель управления». */
  group: SectionGroup;
  /** Точное совпадение пути (для /admin, чтобы не подсвечивался везде). */
  end?: boolean;
}

export type SectionGroup = 'Каталог' | 'Контент и связь' | 'Команда' | 'Контроль';

export const SECTION_GROUPS: SectionGroup[] = ['Каталог', 'Контент и связь', 'Команда', 'Контроль'];

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'resources',
    to: '/admin',
    label: 'Ресурсы',
    hint: 'Каталог, цены и категории предметов',
    icon: Boxes,
    permission: 'resources.read',
    inTabs: false,
    group: 'Каталог',
    end: true,
  },
  {
    key: 'categories',
    to: '/admin/categories',
    label: 'Категории',
    hint: 'Группы предметов и их порядок',
    icon: Tags,
    permission: 'categories.read',
    inTabs: false,
    group: 'Каталог',
  },
  {
    key: 'import',
    to: '/admin/import',
    label: 'Импорт',
    hint: 'Загрузка прайса и иконок',
    icon: Upload,
    permission: 'import.run',
    inTabs: false,
    group: 'Каталог',
  },
  {
    key: 'news',
    to: '/admin/news',
    label: 'Новости',
    hint: 'Публикации на главной и в ленте',
    icon: Newspaper,
    permission: 'news.write',
    inTabs: false,
    group: 'Контент и связь',
  },
  {
    key: 'appearance',
    to: '/admin/appearance',
    label: 'Оформление',
    hint: 'Хэллоуин и сезонные эффекты сайта',
    icon: Palette,
    permission: 'settings.manage',
    inTabs: true,
    group: 'Контент и связь',
  },
  {
    key: 'support',
    to: '/admin/support',
    label: 'Обращения',
    hint: 'Тикеты пользователей и ответы',
    icon: MessageSquareWarning,
    permission: 'support.read',
    inTabs: true,
    group: 'Контент и связь',
  },
  {
    key: 'chat',
    to: '/admin/chat',
    label: 'Служебный чат',
    hint: 'Комнаты для администрации',
    icon: MessagesSquare,
    permission: 'chat.use',
    inTabs: true,
    group: 'Контент и связь',
  },
  {
    key: 'users',
    to: '/admin/users',
    label: 'Пользователи',
    hint: 'Заявки, роли и префиксы',
    icon: UsersRound,
    permission: 'users.read',
    inTabs: true,
    group: 'Команда',
  },
  {
    key: 'access',
    to: '/admin/access',
    label: 'Доступ',
    hint: 'Роли, права и уровни доступа',
    icon: ShieldCheck,
    permission: 'roles.manage',
    anyPermission: 'prefixes.manage',
    inTabs: true,
    group: 'Команда',
  },
  {
    key: 'stats',
    to: '/admin/stats',
    label: 'Статистика',
    hint: 'Посещения и активность',
    icon: BarChart3,
    permission: 'stats.view',
    inTabs: true,
    group: 'Контроль',
  },
  {
    key: 'logs',
    to: '/admin/logs',
    label: 'Логи',
    hint: 'Журнал действий администрации',
    icon: ScrollText,
    permission: 'logs.read',
    inTabs: true,
    group: 'Контроль',
  },
];

/** Есть ли у пользователя доступ к разделу. */
export function canOpenSection(section: AdminSection, can: (permission: string) => boolean): boolean {
  return can(section.permission) || (section.anyPermission ? can(section.anyPermission) : false);
}

export function sectionPermissions(section: AdminSection): string[] {
  return section.anyPermission ? [section.permission, section.anyPermission] : [section.permission];
}

export interface SectionRequirement {
  /** Минимальный уровень среди ролей с этим правом; null — право не выдано никому. */
  level: number | null;
  /** Названия ролей, у которых есть право, по возрастанию уровня. */
  roles: string[];
}

function roleGrants(role: AdminRoleInfo, permission: string): boolean {
  return role.permissions.includes('*') || role.permissions.includes(permission);
}

/**
 * С какого уровня открыт раздел: минимум по ролям, которым выдано право.
 * Если права нет ни у одной роли — раздел закрыт для всех, кроме владельца.
 */
export function sectionRequirement(
  section: AdminSection,
  roles: AdminRoleInfo[],
): SectionRequirement {
  const matching = roles
    .filter((role) => sectionPermissions(section).some((permission) => roleGrants(role, permission)))
    .sort((a, b) => a.access_level - b.access_level);

  if (matching.length === 0) return { level: null, roles: [] };

  return {
    level: matching[0].access_level,
    roles: matching.map((role) => role.name),
  };
}

/** Человеческая подпись уровня. */
export function levelCaption(level: number | null): string {
  if (level === null) return 'нет прав';
  if (level <= 0) return 'всем администраторам';
  return `с ${level} уровня`;
}
