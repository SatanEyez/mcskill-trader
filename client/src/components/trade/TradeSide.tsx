import { useId, useMemo } from 'react';
import { PackageOpen, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Resource } from '../../types';
import { formatPriceDots, formatQuantityLabel } from '../../lib/format';
import { MAX_TRADE_LINES, type TradeLine } from '../../lib/trade';
import { AutoFitText } from '../ui/AutoFitText';
import { CoinInput } from './CoinInput';
import { TradeItemRow } from './TradeItemRow';

interface TradeSideProps {
  title: string;
  hint: string;
  tone: 'a' | 'b';
  lines: TradeLine[];
  resources: Resource[];
  /** Стоимость стороны целиком: предметы + монеты. */
  total: number;
  /** Стоимость только предметов. */
  itemsTotal: number;
  /** Монеты, добавленные к стороне. */
  coins: number;
  totalQuantity: number;
  onAdd: () => void;
  onCoinsChange: (coins: number) => void;
  onQuantityChange: (resourceId: string, quantity: number) => void;
  onRemove: (resourceId: string) => void;
  onClear: () => void;
  className?: string;
}

const TONE_STYLES = {
  a: {
    badge: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200',
    marker: 'bg-amber-400/70',
  },
  b: {
    badge: 'border-accent/25 bg-accent/[0.08] text-accent',
    marker: 'bg-accent/80',
  },
} as const;

export function TradeSide({
  title,
  hint,
  tone,
  lines,
  resources,
  total,
  itemsTotal,
  coins,
  totalQuantity,
  onAdd,
  onCoinsChange,
  onQuantityChange,
  onRemove,
  onClear,
  className,
}: TradeSideProps) {
  const titleId = useId();
  const styles = TONE_STYLES[tone];
  const atLimit = lines.length >= MAX_TRADE_LINES;

  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );

  return (
    <section className={clsx('panel flex flex-col p-4', className)} aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', styles.marker)} aria-hidden />
            <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-white">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
        </div>

        <span
          className={clsx(
            'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
            styles.badge,
          )}
        >
          {lines.length} / {MAX_TRADE_LINES}
        </span>
      </div>

      <div className="mt-3 border-b border-white/[0.05] pb-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <AutoFitText
            max={24}
            min={8}
            className="min-w-0 flex-1 font-display font-semibold text-white"
            title={`${formatPriceDots(total)} монет`}
          >
            {formatPriceDots(total)}
          </AutoFitText>
          <span className="shrink-0 text-[11px] text-slate-500">монет</span>
        </div>

        {coins > 0 && lines.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center justify-end gap-x-1 text-[10px] text-slate-500">
            <span>предметы {formatPriceDots(itemsTotal)}</span>
            <span className="text-slate-600">+</span>
            <span className="text-amber-200/80">{formatPriceDots(coins)}</span>
          </p>
        )}

        {totalQuantity > 0 && (
          <p className="mt-1 text-right text-[10px] text-slate-500">
            {formatQuantityLabel(totalQuantity)}
          </p>
        )}

        <CoinInput className="mt-2" value={coins} onChange={onCoinsChange} />
      </div>

      {lines.length === 0 ? (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
          <PackageOpen className="h-6 w-6 text-slate-600" aria-hidden />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Список пуст. Добавьте предметы
            <br />
            из каталога сервера.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-2">
          {lines.map((line) => {
            const resource = resourcesById.get(line.resourceId);
            if (!resource) return null;

            return (
              <TradeItemRow
                key={line.resourceId}
                resource={resource}
                quantity={line.quantity}
                onChange={(quantity) => onQuantityChange(line.resourceId, quantity)}
                onRemove={() => onRemove(line.resourceId)}
              />
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-secondary flex-1 px-3 py-2 text-xs"
          title={
            atLimit
              ? `В одной стороне может быть не больше ${MAX_TRADE_LINES} предметов — новые добавятся после удаления старых`
              : undefined
          }
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {atLimit ? `Лимит ${MAX_TRADE_LINES} предметов` : 'Добавить предмет'}
        </button>

        {lines.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="icon-btn h-9 w-9 shrink-0 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
            title="Очистить сторону"
            aria-label={`Очистить «${title}»`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
