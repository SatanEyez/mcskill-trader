import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import clsx from 'clsx';
import { formatPriceDots, formatQuantityDots } from '../../lib/format';
import { EQUALITY_TOLERANCE_SHARE, formatGapPercent } from '../../lib/trade-rules';
import type { ExchangePlan } from '../../lib/exchange';
import { AutoFitText } from '../ui/AutoFitText';

interface ExchangeSummaryProps {
  /** Стоимость стороны «отдаю» — считается и без подобранного набора. */
  givenTotal: number;
  plan: ExchangePlan | null;
  className?: string;
}

export function ExchangeSummary({ givenTotal, plan, className }: ExchangeSummaryProps) {
  const ok = plan?.ok ?? false;
  const delta = plan?.delta ?? 0;
  const gapPercent = plan?.gapPercent ?? 0;
  const signedGapPercent = plan?.signedGapPercent ?? 0;
  const tolerance = plan?.tolerance ?? 0;

  // Полоса заполняется по мере приближения к границе допуска.
  const barWidth = Math.min(100, (gapPercent / (EQUALITY_TOLERANCE_SHARE * 100)) * 100);

  return (
    <section className={clsx('panel p-4', className)} aria-labelledby="exchange-summary-title">
      <div className="flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        <h2
          id="exchange-summary-title"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
        >
          Итог
        </h2>
      </div>

      <dl className="mt-3 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="shrink-0 text-[11px] text-slate-500">Отдаю</dt>
          <dd className="min-w-0 flex-1 text-right">
            <AutoFitText
              max={14}
              min={7}
              className="font-display text-sm font-semibold text-amber-200"
              title={`${formatPriceDots(givenTotal)} монет`}
            >
              {formatPriceDots(givenTotal)}
            </AutoFitText>
          </dd>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <dt className="shrink-0 text-[11px] text-slate-500">Получаю</dt>
          <dd className="min-w-0 flex-1 text-right">
            <AutoFitText
              max={14}
              min={7}
              className="font-display text-sm font-semibold text-accent-300"
              title={`${formatPriceDots(plan?.total ?? 0)} монет`}
            >
              {formatPriceDots(plan?.total ?? 0)}
            </AutoFitText>
            {plan?.items[0] && (
              <p
                className="mt-0.5 truncate text-[10px] text-slate-500"
                title={`${plan.items[0].resource.name} × ${formatQuantityDots(plan.items[0].quantity)}`}
              >
                {plan.items[0].resource.name} × {formatQuantityDots(plan.items[0].quantity)}
              </p>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
            plan
              ? ok
                ? 'border-accent/30 bg-accent/[0.08] text-accent'
                : 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200'
              : 'border-white/[0.07] bg-white/[0.02] text-slate-500',
          )}
        >
          {plan ? (
            ok ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden />
            ) : (
              <AlertTriangle className="h-3 w-3" aria-hidden />
            )
          ) : (
            <Scale className="h-3 w-3" aria-hidden />
          )}
          {plan ? (ok ? 'Минка к минке' : 'Вне допуска') : 'Нет варианта'}
        </span>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-slate-500">Разница</span>
          <span
            className={clsx(
              'text-[11px] font-semibold tabular-nums',
              !plan ? 'text-slate-500' : ok ? 'text-accent-300' : 'text-amber-200',
            )}
          >
            {plan ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatPriceDots(Math.abs(delta))}` : '—'}
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={clsx(
              'h-full rounded-full transition-[width] duration-300',
              ok ? 'bg-accent' : 'bg-amber-400',
            )}
            style={{ width: plan ? `${Math.max(barWidth, gapPercent > 0 ? 3 : 0)}%` : '0%' }}
          />
        </div>

        <p className="mt-1.5 flex items-baseline justify-between gap-2 text-[10px] text-slate-600">
          <span>погрешность</span>
          <span className={clsx('tabular-nums', ok ? 'text-slate-500' : 'text-amber-200/80')}>
            {plan ? formatGapPercent(signedGapPercent) : '—'} из 10%
          </span>
        </p>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          Допуск — 10% от меньшей стороны сделки
          {plan && `: ±${formatPriceDots(tolerance)} монет`}. Правило 9.10.
          {plan && signedGapPercent < 0 && ' Минус — получаете меньше, чем отдаёте.'}
        </p>
      </div>
    </section>
  );
}
