import clsx from 'clsx';
import { useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingUsersCount } from '../../hooks/useAdminUsers';
import { useChatUnreadBadge } from '../../hooks/useChat';
import { useTicketStats } from '../../hooks/useTicketStats';
import { ADMIN_SECTIONS, canOpenSection } from '../../lib/admin-sections';
import { prefetchRoute, warmRoutes } from '../../lib/prefetch';

export function AdminTabs() {
  const { can } = useAuth();

  const canSeeUsers = can('users.read');
  const pendingCount = usePendingUsersCount(canSeeUsers);
  const canSeeSupport = can('support.read');
  const { counts } = useTicketStats(canSeeSupport);
  const chatUnread = useChatUnreadBadge(can('chat.use'));

  // Пока админ смотрит на текущую вкладку, тихо тянем данные соседних:
  // к переходу они уже в кэше.
  useEffect(() => {
    warmRoutes();
  }, []);

  const visibleTabs = ADMIN_SECTIONS.filter((section) => section.inTabs && canOpenSection(section, can));

  return (
    <div className="border-b border-white/[0.05] bg-abyss/60 backdrop-blur">
      <div className="container-page flex items-center gap-1 overflow-x-auto">
        {/* «Панель управления» — полноценная вкладка, а не выпадающий список.
            Видна любому администратору: это точка входа в остальные разделы. */}
        <NavLink
          to="/admin/panel"
          onMouseEnter={() => prefetchRoute('/admin/panel')}
          onFocus={() => prefetchRoute('/admin/panel')}
          className={({ isActive }) =>
            clsx(
              'group relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
              isActive
                ? 'border-accent/40 bg-accent/[0.12] text-accent'
                : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-accent/30 hover:text-white',
            )
          }
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          Панель управления
        </NavLink>

        {visibleTabs.length > 0 && (
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
              onMouseEnter={() => prefetchRoute(tab.to)}
              onFocus={() => prefetchRoute(tab.to)}
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
