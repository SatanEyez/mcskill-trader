import { ArrowUpRight, Coins } from 'lucide-react';
import { formatPrice } from '../../lib/format';
import { readableNameColor } from '../../lib/color';
import { categoryStyle } from '../../lib/constants';
import type { Resource } from '../../types';
import { ItemImage } from '../ui/ItemImage';

interface ResourceCardProps {
  resource: Resource;
  onUse: (resource: Resource) => void;
}

export function ResourceCard({ resource, onUse }: ResourceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onUse(resource)}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-panel/80 p-4 text-left shadow-card backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-[#0d1620] hover:shadow-glow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      aria-label={`${resource.name}, минимальная цена ${formatPrice(resource.min_price)} монет. Открыть в трейд-калькуляторе`}
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/0 blur-2xl transition duration-300 group-hover:bg-accent/10"
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.07] to-transparent p-1.5 transition group-hover:border-accent/20">
          <ItemImage src={resource.image_url} alt={resource.name} className="h-full w-full" />
        </span>

        <span
          className={`inline-flex max-w-[55%] items-center truncate rounded-full border px-2.5 py-1 text-[10px] font-medium ${categoryStyle(resource.category)}`}
          title={resource.category}
        >
          {resource.category}
        </span>
      </div>

      <h3
        className="mt-4 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-100 transition group-hover:text-white"
        style={{ color: readableNameColor(resource.name_color) }}
        title={resource.name}
      >
        {resource.name}
      </h3>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <Coins className="h-3.5 w-3.5 shrink-0 self-center text-accent" aria-hidden />
        <span className="font-display text-lg font-semibold leading-none text-accent-300">
          {formatPrice(resource.min_price)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">монет</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">мин. цена</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition group-hover:text-accent">
          В трейд-калькулятор
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </button>
  );
}
