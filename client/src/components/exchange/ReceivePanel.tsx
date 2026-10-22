import type { ReactNode } from 'react';
import { AlertTriangle, PackageSearch, Shuffle, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { categoryStyle } from '../../lib/constants';
import { readableNameColor } from '../../lib/color';
import { formatPriceDots, formatQuantityDots, pluralize } from '../../lib/format';
import { formatGapPercent } from '../../lib/trade-rules';
import { MAX_EXCHANGE_LINES, type ExchangeResult } from '../../lib/exchange';
import { AutoFitText } from '../ui/AutoFitText';
import { ItemImage } from '../ui/ItemImage';

interface ReceivePanelProps {
  result: ExchangeResult | null;
  /** Есть ли предмет на стороне «отдаю» — от этого зависит текст пустого состояния. */
  hasGiven: boolean;
  onReroll: () => void;
  className?: string;
}

export function ReceivePanel({ result, hasGiven, onReroll, className }: ReceivePanelProps) {
  const plan = result?.plan ?? null;
  const items = plan?.items ?? [];

  return (
    <section className={clsx('panel flex flex-col p-4', className)} aria-labelledby="exchange-receive-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80" aria-hidden />
            <h2
              id="exchange-receive-title"
              className="min-w-0 truncate text-base font-semibold text-white"
            >
              Я получаю
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Подобрано автоматически по минимальным ценам
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-[10px] font-semibold text-accent">
          {items.length} / {MAX_EXCHANGE_LINES}
        </span>
      </div>

      <div className="mt-3 border-b border-white/[0.05] pb-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <AutoFitText
            max={24}
            min={8}
            className="min-w-0 flex-1 font-display font-semibold text-white"
            title={`${formatPriceDots(plan?.total ?? 0)} монет`}
          >
            {formatPriceDots(plan?.total ?? 0)}
          </AutoFitText>
          <span className="shrink-0 text-[11px] text-slate-500">монет</span>
        </div>

        {plan && plan.items.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center justify-end gap-x-1 text-[10px] text-slate-500">
            <span>
              {formatQuantityDots(plan.totalQuantity)}{' '}
              {pluralize(plan.totalQuantity, ['штука', 'штуки', 'штук'])}
            </span>
            <span className="text-slate-600">·</span>
            <span className={plan.ok ? 'text-accent-300' : 'text-amber-200/80'}>
              разница {formatGapPercent(plan.gapPercent)}
            </span>
          </p>
        )}
      </div>

      {!hasGiven ? (
        <EmptyState
          icon={<PackageSearch className="h-7 w-7 text-slate-600" aria-hidden />}
          title="Пока нечего подбирать"
          text="Укажите предмет и количество слева — набор появится здесь сразу."
        />
      ) : !result || items.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7 text-amber-300/70" aria-hidden />}
          title="Набор не собрался"
          text="Подходящих по цене предметов нет. Уменьшите количество, выберите предмет подешевле или проверьте, что у него указана минимальная цена."
        />
      ) : (
        <ul className="mt-3 flex-1 space-y-2">
          {items.map((item) => (
            <li
              key={item.resource.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:border-white/[0.1]"
            >
              <div className="flex items-start gap-2.5">
                <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                  <ItemImage
                    src={item.resource.image_url}
                    alt={item.resource.name}
                    className="h-12 w-12"
                  />
                  {/* Счётчик в углу слота — как в инвентаре: количество видно сразу. */}
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-md border border-accent/30 bg-[#07110d] px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-300 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                    ×{formatQuantityDots(item.quantity)}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-slate-100"
                    style={{ color: readableNameColor(item.resource.name_color) }}
                    title={item.resource.name}
                  >
                    {item.resource.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={clsx(
                        'inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[9px] font-medium',
                        categoryStyle(item.resource.category),
                      )}
                    >
                      {item.resource.category}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatPriceDots(item.unitPrice)} / шт.
                    </span>
                  </div>
                </div>
              </div>

              <AutoFitText
                max={12}
                min={6}
                className="mt-1.5 text-right font-display text-xs font-semibold text-accent-300"
                title={`${formatPriceDots(item.total)} монет`}
              >
                {formatPriceDots(item.total)}
              </AutoFitText>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onReroll}
          disabled={!result || result.variants < 2}
          className="btn btn-secondary flex-1 px-3 py-2 text-xs"
          title={
            result && result.variants >= 2
              ? 'Показать другой набор на ту же сумму'
              : 'Других вариантов на эту сумму нет'
          }
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden />
          Другой вариант
        </button>

        {result && result.variants > 1 && (
          <span className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-[10px] font-medium text-slate-500">
            {result.variants}{' '}
            {pluralize(result.variants, ['вариант', 'варианта', 'вариантов'])}
          </span>
        )}
      </div>

      {result && result.validVariants === 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200/80">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Ни один набор не уложился в 10%. Показан самый близкий — такую сделку могут
          посчитать неравноценной.
        </p>
      )}

      {result && result.validVariants > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" aria-hidden />
          {result.validVariants} {pluralize(result.validVariants, ['вариант', 'варианта', 'вариантов'])}{' '}
          в допуске 10%.        </p>
      )}
    </section>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text: string;
}

function EmptyState({ icon, title, text }: EmptyStateProps) {
  return (
    <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
      {icon}
      <p className="mt-2.5 text-xs font-medium text-slate-400">{title}</p>
      <p className="mt-1 max-w-[16rem] text-[11px] leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}
