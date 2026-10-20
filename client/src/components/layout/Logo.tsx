import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={clsx(
        'group flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        className,
      )}
      aria-label="McSkill Trader — на главную"
    >
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-accent/25 bg-accent/[0.08] shadow-glow-sm transition group-hover:border-accent/50">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
          <path
            d="M16 4.5 26.5 10.25v11.5L16 27.5 5.5 21.75v-11.5L16 4.5Z"
            fill="#0f766e"
            stroke="#6ee7b7"
            strokeWidth="1.4"
          />
          <path d="M16 4.5 26.5 10.25 16 16 5.5 10.25 16 4.5Z" fill="#34d399" />
          <path d="M16 16v11.5l10.5-5.75v-11.5L16 16Z" fill="#059669" />
          <path d="M5.5 10.25 16 16v11.5L5.5 21.75v-11.5Z" fill="#047857" />
        </svg>
      </span>

      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-semibold leading-tight text-white">
          McSkill <span className="text-accent">Trader</span>
        </span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          OneBlock market
        </span>
      </span>
    </Link>
  );
}
