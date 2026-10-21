import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Resource } from '../../types';
import { categoryStyle } from '../../lib/constants';
import { readableNameColor } from '../../lib/color';
import { formatPriceDots } from '../../lib/format';
import { MAX_TRADE_QUANTITY, clampQuantity } from '../../lib/trade';
import { AutoFitText } from '../ui/AutoFitText';
import { ItemImage } from '../ui/ItemImage';

interface TradeItemRowProps {
  resource: Resource;
  quantity: number;
  onChange: (quantity: number) => void;
  onRemove: () => void;
}

export function TradeItemRow({ resource, quantity, onChange, onRemove }: TradeItemRowProps) {
  const [draft, setDraft] = useState(String(quantity));

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  const lineTotal = resource.min_price * quantity;
  const lineTotalText = formatPriceDots(lineTotal);

  const commitDraft = () => {
    const parsed = Number(draft);

    if (!Number.isInteger(parsed) || parsed < 1) {
      setDraft(String(quantity));
      return;
    }

    const next = clampQuantity(parsed);
    setDraft(String(next));
    if (next !== quantity) onChange(next);
  };

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:border-white/[0.1]">
      <div className="flex items-start gap-2.5">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <ItemImage src={resource.image_url} alt={resource.name} className="h-16 w-16" />
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
          onClick={onRemove}
          className="icon-btn -mt-1 h-7 w-7 shrink-0 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
          title={`Убрать «${resource.name}»`}
          aria-label={`Убрать ${resource.name} из списка`}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(clampQuantity(quantity - 1))}
            disabled={quantity <= 1}
            className="icon-btn h-7 w-7"
            aria-label={`Уменьшить количество ${resource.name}`}
          >
            <Minus className="h-3 w-3" aria-hidden />
          </button>

          <input
            value={draft}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '').slice(0, 19);
              const parsed = Number(next);

              if (!next) {
                setDraft('');
                return;
              }

              if (Number.isInteger(parsed) && parsed >= 1) {
                const clamped = clampQuantity(parsed);
                setDraft(String(clamped));
                if (clamped !== quantity) onChange(clamped);
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
            style={{ width: `${Math.min(19, Math.max(3, draft.length)) + 1.5}ch` }}
            className="field h-7 min-w-14 px-1 py-0 text-center text-xs font-semibold"
            aria-label={`Количество ${resource.name}`}
          />

          <button
            type="button"
            onClick={() => onChange(clampQuantity(quantity + 1))}
            disabled={quantity >= MAX_TRADE_QUANTITY}
            className="icon-btn h-7 w-7"
            aria-label={`Увеличить количество ${resource.name}`}
          >
            <Plus className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {/* Сумма строки — на своей строке: так длинные числа получают всю ширину карточки. */}
        <div className="w-full min-w-0">
          <AutoFitText
            max={12}
            min={6}
            className="text-right font-display text-xs font-semibold text-accent-300"
            title={`${lineTotalText} монет`}
          >
            {lineTotalText}
          </AutoFitText>
        </div>
      </div>
    </li>
  );
}
