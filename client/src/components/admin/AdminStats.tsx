import { Boxes, Coins, Crown, Layers } from 'lucide-react';
import type { ResourceStats } from '../../types';
import { formatPrice } from '../../lib/format';

interface AdminStatsProps {
  stats: ResourceStats | null;
  loading: boolean;
}

const STAT_STYLES = {
  emerald: 'border-accent/20 bg-accent/[0.08] text-accent',
  cyan: 'border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300',
  amber: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
  fuchsia: 'border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300',
} as const;

export function AdminStats({ stats, loading }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Ресурсов
          </span>
          <span className={`grid h-8 w-8 place-items-center rounded-lg border ${STAT_STYLES.emerald}`}>
            <Boxes className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold text-white">
          {loading ? '—' : (stats?.total ?? 0)}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">в каталоге</p>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Категорий
          </span>
          <span className={`grid h-8 w-8 place-items-center rounded-lg border ${STAT_STYLES.cyan}`}>
            <Layers className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold text-white">
          {loading ? '—' : (stats?.categories.length ?? 0)}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">групп предметов</p>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Средняя цена
          </span>
          <span className={`grid h-8 w-8 place-items-center rounded-lg border ${STAT_STYLES.amber}`}>
            <Coins className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold text-white">
          {loading ? '—' : stats?.avg_price === null || stats?.avg_price === undefined ? '—' : formatPrice(stats.avg_price)}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">монет за предмет</p>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Самое дорогое
          </span>
          <span className={`grid h-8 w-8 place-items-center rounded-lg border ${STAT_STYLES.fuchsia}`}>
            <Crown className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p
          className="mt-3 truncate font-display text-lg font-semibold text-white"
          title={stats?.most_expensive?.name ?? undefined}
        >
          {loading ? '—' : (stats?.most_expensive?.name ?? '—')}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">
          {stats?.most_expensive
            ? `${formatPrice(stats.most_expensive.min_price)} монет`
            : 'нет данных'}
        </p>
      </div>
    </div>
  );
}
