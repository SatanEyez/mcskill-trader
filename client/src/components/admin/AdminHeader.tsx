import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../layout/Logo';
import { ChangePasswordButton } from './ChangePasswordModal';

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
              className="hidden max-w-[220px] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:bg-white/[0.05] sm:inline-flex"
              title="Мой профиль"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-lg border text-[10px] font-semibold uppercase"
                style={{
                  color: prefixColor,
                  borderColor: `${prefixColor}55`,
                  backgroundColor: `${prefixColor}14`,
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                    aria-hidden
                  />
                ) : (
                  user.login.slice(0, 1)
                )}
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-xs font-semibold"
                  style={{ color: prefixColor }}
                  title={user.login}
                >
                  {user.prefix ? `${user.prefix.name} · ` : ''}
                  {user.login}
                </span>
                <span className="block truncate text-[9px] uppercase tracking-wider text-slate-500">
                  {roleLabel}
                </span>
              </span>
            </Link>
          )}

          <ChangePasswordButton />

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
