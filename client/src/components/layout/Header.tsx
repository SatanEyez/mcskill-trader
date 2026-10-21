import { Calculator, LockKeyhole, MessageSquareWarning, Newspaper } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Logo } from './Logo';

const NAV_LINK_CLASS =
  'rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/[0.04] hover:text-white';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-void/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          <Link to="/#resources" className={clsx(NAV_LINK_CLASS, 'text-slate-400')}>
            Ресурсы
          </Link>
          <NavLink
            to="/news"
            className={({ isActive }) =>
              clsx(
                NAV_LINK_CLASS,
                'inline-flex items-center gap-2',
                isActive ? 'bg-white/[0.05] text-white' : 'text-slate-400',
              )
            }
          >
            <Newspaper className="h-3.5 w-3.5" aria-hidden />
            Новости
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              clsx(
                NAV_LINK_CLASS,
                'inline-flex items-center gap-2',
                isActive ? 'bg-white/[0.05] text-white' : 'text-slate-400',
              )
            }
          >
            <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden />
            Репорт
          </NavLink>
          <NavLink
            to="/trade"
            className={({ isActive }) =>
              clsx(
                NAV_LINK_CLASS,
                'inline-flex items-center gap-2',
                isActive ? 'bg-white/[0.05] text-white' : 'text-slate-400',
              )
            }
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden />
            Трейд-калькулятор
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-slate-400 lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            McSkill · OneBlock
          </span>

          <NavLink
            to="/news"
            className={({ isActive }) =>
              clsx('icon-btn md:hidden', isActive && 'border-accent/40 bg-accent/10 text-accent')
            }
            aria-label="Новости"
            title="Новости"
          >
            <Newspaper className="h-4 w-4" aria-hidden />
          </NavLink>

          <NavLink
            to="/report"
            className={({ isActive }) =>
              clsx('icon-btn md:hidden', isActive && 'border-accent/40 bg-accent/10 text-accent')
            }
            aria-label="Сообщить о проблеме"
            title="Сообщить о проблеме"
          >
            <MessageSquareWarning className="h-4 w-4" aria-hidden />
          </NavLink>

          <NavLink
            to="/trade"
            className={({ isActive }) =>
              clsx('icon-btn md:hidden', isActive && 'border-accent/40 bg-accent/10 text-accent')
            }
            aria-label="Трейд-калькулятор"
            title="Трейд-калькулятор"
          >
            <Calculator className="h-4 w-4" aria-hidden />
          </NavLink>

          <Link to="/admin" className="btn btn-secondary px-3 py-2 text-xs sm:px-4">
            <LockKeyhole className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Админ-панель</span>
            <span className="sr-only sm:hidden">Админ-панель</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
