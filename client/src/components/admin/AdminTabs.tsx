import {
  BarChart3,
  Boxes,
  Newspaper,
  ScrollText,
  ShieldCheck,
  Tags,
  Upload,
  UsersRound,
  MessageSquareWarning,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingUsersCount } from '../../hooks/useAdminUsers';
import { useTicketStats } from '../../hooks/useTicketStats';

interface Tab {
  to: string;
  label: string;
  icon: typeof Boxes;
  end: boolean;
  permission: string;
  /** Второе право, если достаточно любого из двух. */
  anyPermission?: string;
  /** Вкладка видна любому действующему администратору. */
  alwaysVisible?: boolean;
}

const TABS: Tab[] = [
  { to: '/admin', label: 'Ресурсы', icon: Boxes, end: true, permission: 'resources.read' },
  { to: '/admin/categories', label: 'Категории', icon: Tags, end: false, permission: 'categories.read' },
  { to: '/admin/news', label: 'Новости', icon: Newspaper, end: false, permission: 'news.write' },
  { to: '/admin/support', label: 'Обращения', icon: MessageSquareWarning, end: false, permission: 'support.read' },
  { to: '/admin/users', label: 'Пользователи', icon: UsersRound, end: false, permission: 'users.read' },
  {
    to: '/admin/access',
    label: 'Доступ',
    icon: ShieldCheck,
    end: false,
    permission: 'roles.manage',
    anyPermission: 'prefixes.manage',
  },
  { to: '/admin/import', label: 'Импорт', icon: Upload, end: false, permission: 'import.run' },
  { to: '/admin/stats', label: 'Статистика', icon: BarChart3, end: false, permission: 'stats.view' },
  { to: '/admin/logs', label: 'Логи', icon: ScrollText, end: false, permission: 'logs.read' },
  {
    to: '/admin/profile',
    label: 'Профиль',
    icon: UserRound,
    end: false,
    permission: 'dashboard.view',
    alwaysVisible: true,
  },
];

export function AdminTabs() {
  const { can } = useAuth();
  const canSeeUsers = can('users.read');
  const pendingCount = usePendingUsersCount(canSeeUsers);
  const canSeeSupport = can('support.read');
  const { counts } = useTicketStats(canSeeSupport);

  const visible = TABS.filter(
    (tab) =>
      tab.alwaysVisible ||
      can(tab.permission) ||
      (tab.anyPermission ? can(tab.anyPermission) : false),
  );

  if (visible.length === 0) return null;

  return (
    <div className="border-b border-white/[0.05] bg-abyss/60 backdrop-blur">
      <div className="container-page flex gap-1 overflow-x-auto">
        {visible.map((tab) => {
          const Icon = tab.icon;
          const badge =
            tab.to === '/admin/users' && pendingCount > 0
              ? pendingCount
              : tab.to === '/admin/support' && (counts?.new ?? 0) > 0
                ? counts!.new
                : null;

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition',
                  isActive
                    ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                    : 'text-slate-500 hover:text-slate-300',
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
              {badge !== null && (
                <span
                  className={clsx(
                    'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold',
                    tab.to === '/admin/support'
                      ? 'bg-rose-400/90 text-[#1b0505]'
                      : 'bg-amber-400/90 text-[#1b1205]',
                  )}
                  title={
                    tab.to === '/admin/support'
                      ? `${badge} новых обращений`
                      : `${badge} заявок ожидают одобрения`
                  }
                >
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
