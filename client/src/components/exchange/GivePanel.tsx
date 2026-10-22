import { useEffect, useState } from 'react';
import { Minus, PackagePlus, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Resource } from '../../types';
import { categoryStyle } from '../../lib/constants';
import { readableNameColor } from '../../lib/color';
import { formatPriceDots, formatQuantityDots } from '../../lib/format';
import { MAX_GIVE_QUANTITY, MIN_GIVE_QUANTITY, clampGiveQuantity } from '../../lib/exchange';
import { AutoFitText } from '../ui/AutoFitText';
import { ItemImage } from '../ui/ItemImage';

/** Быстрый выбор количества: стак и его половины — самые частые случаи. */
const QUICK_QUANTITIES = [1, 8, 16, 32, 64] as const;

interface GivePanelProps {
  resource: Resource | null;
  quantity: number;
  total: number;
  onQuantityChange: (quantity: number) => void;
  onPick: () => void;
  onClear: () => void;
  className?: string;
}

export function GivePanel({
  resource,
  quantity,
  total,
  onQuantityChange,
  onPick,
  onClear,
  className,
}: GivePanelProps) {
  const [draft, setDraft] = useState(String(quantity));

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  const commitDraft = () => {
    const parsed = Number(draft);

    if (!Number.isInteger(parsed) || parsed < MIN_GIVE_QUANTITY) {
      setDraft(String(quantity));
      return;
    }

    const next = clampGiveQuantity(parsed);
    setDraft(String(next));
    if (next !== quantity) onQuantityChange(next);
  };

  return (
    <section className={clsx('panel flex flex-col p-4', className)} aria-labelledby="exchange-give-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" aria-hidden />
            <h2 id="exchange-give-title" className="min-w-0 truncate text-base font-semibold text-white">
              Я отдаю
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Один предмет и количество от 1 до {MAX_GIVE_QUANTITY}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1 text-[10px] font-semibold text-amber-200">
          {resource ? `${quantity} / ${MAX_GIVE_QUANTITY}` : `0 / ${MAX_GIVE_QUANTITY}`}
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

        {resource && (
          <p className="mt-1 text-right text-[10px] text-slate-500">
            {formatQuantityDots(quantity)} × {formatPriceDots(resource.min_price)} монет
          </p>
        )}
      </div>

      {!resource ? (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
          <PackagePlus className="h-7 w-7 text-slate-600" aria-hidden />
          <p className="mt-2.5 max-w-[15rem] text-xs leading-relaxed text-slate-500">
            Выберите предмет, который отдаёте, — набор на вторую сторону подберётся сам.
          </p>
          <button type="button" onClick={onPick} className="btn btn-primary mt-4 px-4 py-2 text-xs">
            <PackagePlus className="h-3.5 w-3.5" aria-hidden />
            Выбрать предмет
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex items-start gap-2.5">
              <span className="relative grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <ItemImage src={resource.image_url} alt={resource.name} className="h-16 w-16" eager />
                <span className="absolute -bottom-1.5 -right-1.5 rounded-md border border-amber-400/30 bg-[#12100a] px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-200 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  ×{formatQuantityDots(quantity)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-slate-100"
                  style={{ color: readableNameColor(resource.name_color) }}
                  title={resource.name}
                >
                  {resource.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={clsx(
                      'inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[9px] font-medium',
                      categoryStyle(resource.category),
                    )}
                  >
                    {resource.category}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatPriceDots(resource.min_price)} / шт.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClear}
                className="icon-btn -mt-1 h-7 w-7 shrink-0 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                title={`Убрать «${resource.name}»`}
                aria-label={`Убрать ${resource.name}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(quantity - 1)}
                disabled={quantity <= MIN_GIVE_QUANTITY}
                className="icon-btn h-8 w-8 shrink-0"
                aria-label="Уменьшить количество"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>

              <input
                value={draft}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '').slice(0, 2);

                  if (!next) {
                    setDraft('');
                    return;
                  }

                  const parsed = Number(next);
                  if (parsed >= MIN_GIVE_QUANTITY) {
                    const clamped = clampGiveQuantity(parsed);
                    setDraft(String(clamped));
                    if (clamped !== quantity) onQuantityChange(clamped);
                    return;
                  }

                  setDraft(next);
                }}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitDraft();
                  }
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                className="field h-8 w-16 px-1 py-0 text-center text-sm font-semibold"
                aria-label="Количество, которое отдаю"
              />

              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                disabled={quantity >= MAX_GIVE_QUANTITY}
                className="icon-btn h-8 w-8 shrink-0"
                aria-label="Увеличить количество"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </button>

              <span className="ml-auto text-[10px] text-slate-500">из {MAX_GIVE_QUANTITY}</span>
            </div>

            <input
              type="range"
              min={MIN_GIVE_QUANTITY}
              max={MAX_GIVE_QUANTITY}
              step={1}
              value={quantity}
              onChange={(event) => onQuantityChange(Number(event.target.value))}
              className="range-slider mt-3"
              aria-label="Количество ползунком"
            />

            <div className="mt-2 grid grid-cols-5 gap-1">
              {QUICK_QUANTITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onQuantityChange(value)}
                  aria-pressed={quantity === value}
                  className={clsx(
                    'h-7 rounded-lg border text-[11px] font-semibold transition',
                    quantity === value
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200',
                  )}
                  title={`${value} шт.`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onPick}
            className="btn btn-secondary mt-3 w-full px-3 py-2 text-xs"
          >
            <PackagePlus className="h-3.5 w-3.5" aria-hidden />
            Заменить предмет
          </button>
        </>
      )}
    </section>
  );
}
