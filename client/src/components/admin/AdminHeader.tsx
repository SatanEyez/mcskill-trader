import { ChevronRight, ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PrefixName } from '../ui/PrefixName';
import { Logo } from '../layout/Logo';
import { AdminAvatar } from './AdminAvatar';

export function AdminHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const roleLabel = user?.role_name ?? (user?.role === 'owner' ? 'Владелец' : 'Администратор');
  const prefixColor = user?.prefix?.color ?? '#34D399';

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-void/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden items-center gap-1.5 rounded-full border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent sm:inline-flex">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Link
              to="/admin/profile"
              title="Профиль: аватар, префикс и пароль"
              className="group flex max-w-[16rem] items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.015] py-1.5 pl-1.5 pr-2.5 transition hover:border-accent/35 hover:from-accent/[0.10] hover:to-white/[0.02]"
            >
              <AdminAvatar
                login={user.login}
                avatarUrl={user.avatar_url}
                color={prefixColor}
                size="md"
                rounded="xl"
                initials={1}
              />

              <span className="hidden min-w-0 sm:block">
                <span className="flex items-center gap-1.5">
                  {user.prefix && (
                    <span
                      className="shrink-0 rounded-full border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        color: prefixColor,
                        borderColor: `${prefixColor}55`,
                        backgroundColor: `${prefixColor}1f`,
                      }}
                    >
                      <PrefixName prefix={user.prefix} />
                    </span>
                  )}
                  <span className="truncate text-xs font-semibold text-white">{user.login}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  {roleLabel}
                  <span className="text-slate-700" aria-hidden>
                    ·
                  </span>
                  <span className="text-accent/80 normal-case tracking-normal">Профиль</span>
                </span>
              </span>

              <ChevronRight
                className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-accent sm:block"
                aria-hidden
              />
            </Link>
          )}

          <Link to="/" className="btn btn-secondary px-3 py-2 text-xs">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">На сайт</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-ghost px-3 py-2 text-xs text-slate-400 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </header>
  );
}
