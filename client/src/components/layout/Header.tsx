import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  Calculator,
  LockKeyhole,
  Menu,
  MessageSquareWarning,
  Newspaper,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { prefetchRoute } from '../../lib/prefetch';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { PumpkinIcon } from '../halloween/HalloweenIcons';
import { TreeIcon } from '../newyear/NewYearIcons';
import { Logo } from './Logo';

const NAV_LINK_CLASS =
  'rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/[0.04] hover:text-white';

const NAV_ITEMS = [
  { to: '/resources', label: 'Ресурсы', icon: Boxes },
  { to: '/news', label: 'Новости', icon: Newspaper },
  { to: '/report', label: 'Репорт', icon: MessageSquareWarning },
  { to: '/trade', label: 'Трейд-калькулятор', icon: Calculator },
  { to: '/exchange', label: 'Обменник', icon: ArrowLeftRight },
] as const;

export function Header() {
  const location = useLocation();
  const { halloween, newYear } = useSiteSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Перешли на другую страницу — меню больше не нужно.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-void/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                className={({ isActive }) =>
                  clsx(
                    NAV_LINK_CLASS,
                    'inline-flex items-center gap-2',
                    isActive ? 'bg-white/[0.05] text-white' : 'text-slate-400',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {halloween ? (
            <span className="hidden items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/[0.07] px-3 py-1.5 text-[11px] font-semibold text-orange-200 xl:inline-flex">
              <PumpkinIcon className="h-3.5 w-3.5" />
              Хэллоуин · McSkill
            </span>
          ) : newYear ? (
            <span className="hidden items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-[11px] font-semibold text-sky-200 xl:inline-flex">
              <TreeIcon className="h-3.5 w-3.5" />
              Новый год · McSkill
            </span>
          ) : (
            <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-slate-400 xl:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              McSkill · OneBlock
            </span>
          )}

          <Link to="/admin" className="btn btn-secondary px-3 py-2 text-xs sm:px-4">
            <LockKeyhole className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Админ-панель</span>
            <span className="sr-only sm:hidden">Админ-панель</span>
          </Link>

          {/* Мобильная навигация: на узких экранах иконки не помещаются в шапку. */}
          <div ref={menuRef} className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className={clsx(
                'icon-btn',
                menuOpen && 'border-accent/40 bg-accent/10 text-accent',
              )}
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden />
              ) : (
                <Menu className="h-4 w-4" aria-hidden />
              )}
            </button>

            {menuOpen && (
              <div
                id="mobile-nav"
                className="fixed inset-x-4 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070c11] p-1.5 shadow-card animate-fade-in"
              >
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          isActive
                            ? 'bg-accent/10 text-accent'
                            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
                        )
                      }
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
