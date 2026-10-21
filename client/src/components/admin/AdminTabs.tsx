import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Boxes,
  ChevronDown,
  LayoutGrid,
  MessagesSquare,
  MessageSquareWarning,
  Newspaper,
  ScrollText,
  ShieldCheck,
  Tags,
  Upload,
  UsersRound,
} from 'lucide-react';
import clsx from 'clsx';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingUsersCount } from '../../hooks/useAdminUsers';
import { useChatUnreadBadge } from '../../hooks/useChat';
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
  /** Пояснение в выпадающем меню «Панель управления». */
  hint?: string;
}

/** Рабочие разделы — живут в выпадающем меню «Панель управления». */
const PANEL_ITEMS: Tab[] = [
  {
    to: '/admin',
    label: 'Ресурсы',
    icon: Boxes,
    end: true,
    permission: 'resources.read',
    hint: 'Каталог, цены и категории предметов',
  },
  {
    to: '/admin/news',
    label: 'Новости',
    icon: Newspaper,
    end: false,
    permission: 'news.write',
    hint: 'Публикации на главной и в ленте',
  },
  {
    to: '/admin/categories',
    label: 'Категории',
    icon: Tags,
    end: false,
    permission: 'categories.read',
    hint: 'Группы предметов и их порядок',
  },
  {
    to: '/admin/import',
    label: 'Импорт',
    icon: Upload,
    end: false,
    permission: 'import.run',
    hint: 'Загрузка прайса и иконок',
  },
];

/** Остальные разделы — обычные вкладки в строке навигации. */
const TABS: Tab[] = [
  {
    to: '/admin/support',
    label: 'Обращения',
    icon: MessageSquareWarning,
    end: false,
    permission: 'support.read',
  },
  {
    to: '/admin/chat',
    label: 'Служебный чат',
    icon: MessagesSquare,
    end: false,
    permission: 'chat.use',
  },
  {
    to: '/admin/users',
    label: 'Пользователи',
    icon: UsersRound,
    end: false,
    permission: 'users.read',
  },
  {
    to: '/admin/access',
    label: 'Доступ',
    icon: ShieldCheck,
    end: false,
    permission: 'roles.manage',
    anyPermission: 'prefixes.manage',
  },
  { to: '/admin/stats', label: 'Статистика', icon: BarChart3, end: false, permission: 'stats.view' },
  { to: '/admin/logs', label: 'Логи', icon: ScrollText, end: false, permission: 'logs.read' },
];

export function AdminTabs() {
  const { can } = useAuth();
  const location = useLocation();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const canSeeUsers = can('users.read');
  const pendingCount = usePendingUsersCount(canSeeUsers);
  const canSeeSupport = can('support.read');
  const { counts } = useTicketStats(canSeeSupport);
  const chatUnread = useChatUnreadBadge(can('chat.use'));

  const visibleTabs = TABS.filter(
    (tab) => can(tab.permission) || (tab.anyPermission ? can(tab.anyPermission) : false),
  );
  const visiblePanel = PANEL_ITEMS.filter((item) => can(item.permission));
  const panelActive = visiblePanel.some((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );

  // Закрываем меню по клику вне него и по Escape.
  useEffect(() => {
    if (!panelOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setPanelOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panelOpen]);

  // Переход по ссылке из меню закрывает его.
  useEffect(() => {
    setPanelOpen(false);
  }, [location.pathname]);

  if (visibleTabs.length === 0 && visiblePanel.length === 0) return null;

  return (
    <div className="border-b border-white/[0.05] bg-abyss/60 backdrop-blur">
      <div className="container-page flex items-center gap-1 overflow-x-auto">
        {visiblePanel.length > 0 && (
          <div ref={panelRef} className="relative shrink-0 py-1.5 pr-1">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={panelOpen}
              className={clsx(
                'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                panelActive || panelOpen
                  ? 'border-accent/40 bg-accent/[0.12] text-accent'
                  : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-accent/30 hover:text-white',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Панель управления
              <ChevronDown
                className={clsx('h-3.5 w-3.5 transition-transform', panelOpen && 'rotate-180')}
                aria-hidden
              />
            </button>

            {panelOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-[19rem] overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
              >
                {visiblePanel.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      role="menuitem"
                      className={({ isActive }) =>
                        clsx(
                          'flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition',
                          isActive
                            ? 'bg-accent/[0.12] text-accent'
                            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
                        )
                      }
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{item.label}</span>
                        {item.hint && (
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {visiblePanel.length > 0 && visibleTabs.length > 0 && (
          <span className="mx-1 h-5 w-px shrink-0 bg-white/[0.08]" aria-hidden />
        )}

        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const badge =
            tab.to === '/admin/users' && pendingCount > 0
              ? pendingCount
              : tab.to === '/admin/support' && (counts?.new ?? 0) > 0
                ? counts!.new
                : tab.to === '/admin/chat' && chatUnread > 0
                  ? chatUnread
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
                      : tab.to === '/admin/chat'
                        ? 'bg-accent/90 text-[#04110c]'
                        : 'bg-amber-400/90 text-[#1b1205]',
                  )}
                  title={
                    tab.to === '/admin/support'
                      ? `${badge} новых обращений`
                      : tab.to === '/admin/chat'
                        ? `${badge} непрочитанных сообщений`
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
