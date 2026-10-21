import { Calculator, Scale, ShieldAlert, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { TradeCalculationResult } from '../../types';
import { formatPrice, formatPriceDots, formatQuantityLabel } from '../../lib/format';
import { equalityTolerance, isWithinEqualityTolerance } from '../../lib/trade-rules';
import { AutoFitText } from '../ui/AutoFitText';

interface TradeSummaryProps {
  result: TradeCalculationResult;
  /** Есть предметы или монеты хотя бы с одной стороны. */
  hasContent: boolean;
  /** Причина, по которой «минка к минке» недоступна; `null` — кнопка активна. */
  alignDisabledReason: string | null;
  /** Что именно изменилось после последнего выравнивания. */
  alignNote: string | null;
  /** Сколько нарушений правил экономики нашла проверка. */
  ruleViolations: number;
  /** Сколько предупреждений (например, неравноценный обмен) нашла проверка. */
  ruleWarnings: number;
  onAlign: () => void;
  onClearAll: () => void;
  className?: string;
}

type Tone = 'neutral' | 'balanced' | 'pay' | 'receive';

const TONE_STYLES: Record<Tone, string> = {
  neutral: 'border-white/[0.07] bg-white/[0.02] text-slate-400',
  balanced: 'border-accent/25 bg-accent/[0.07] text-accent',
  pay: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200',
  receive: 'border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-200',
};

export function TradeSummary({
  result,
  hasContent,
  alignDisabledReason,
  alignNote,
  ruleViolations,
  ruleWarnings,
  onAlign,
  onClearAll,
  className,
}: TradeSummaryProps) {
  const { side_a: sideA, side_b: sideB, delta } = result;

  // П. 9.10: погрешность 10% от суммы сделки — в этих пределах обмен равноценный.
  const withinTolerance = hasContent && delta !== 0 && isWithinEqualityTolerance(result);

  const tone: Tone = !hasContent
    ? 'neutral'
    : delta === 0 || withinTolerance
      ? 'balanced'
      : delta > 0
        ? 'pay'
        : 'receive';

  const title = !hasContent
    ? 'Сделка пуста'
    : delta === 0
      ? 'Обмен равноценный'
      : withinTolerance
        ? 'Разница в пределах погрешности'
        : delta > 0
          ? 'Вы доплачиваете'
          : 'Вам доплачивают';

  const hint = !hasContent
    ? 'Добавьте предметы или монеты в обе стороны — покажем разницу по минимальным ценам.'
    : delta === 0
      ? 'Стороны совпали по стоимости: доплата не нужна.'
      : withinTolerance
        ? `Разница не больше 10% от суммы сделки (${formatPrice(equalityTolerance(result))} монет) — доплата не требуется.`
        : delta > 0
          ? 'Принимающая сторона дороже — разницу стоит доплатить.'
          : 'Отдающая сторона дороже — доплата положена вам.';

  const shareA = sideA.total + sideB.total > 0 ? sideA.total / (sideA.total + sideB.total) : 0.5;

  return (
    <section className={clsx('panel flex flex-col p-4', className)} aria-labelledby="trade-summary-title">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400">
          <Scale className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="trade-summary-title" className="text-sm font-semibold text-white">
          Итог сделки
        </h2>
      </div>

      <div className="mt-4 space-y-3 text-xs">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 text-slate-500">Я отдаю</span>
            <AutoFitText
              max={13}
              min={6}
              className="min-w-0 flex-1 text-right font-semibold text-slate-200"
              title={`${formatPriceDots(sideA.total)} монет`}
            >
              {formatPriceDots(sideA.total)}
            </AutoFitText>
          </div>
          {sideA.items_count > 0 && (
            <p className="mt-0.5 whitespace-nowrap text-right text-[9px] text-slate-500">
              {sideA.items_count} поз. · {formatQuantityLabel(sideA.total_quantity)}
            </p>
          )}
          {sideA.coins > 0 && (
            <p className="mt-0.5 whitespace-nowrap text-right text-[9px] text-amber-200/70">
              в т.ч. монеты: {formatPriceDots(sideA.coins)}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 text-slate-500">Я получаю</span>
            <AutoFitText
              max={13}
              min={6}
              className="min-w-0 flex-1 text-right font-semibold text-slate-200"
              title={`${formatPriceDots(sideB.total)} монет`}
            >
              {formatPriceDots(sideB.total)}
            </AutoFitText>
          </div>
          {sideB.items_count > 0 && (
            <p className="mt-0.5 whitespace-nowrap text-right text-[9px] text-slate-500">
              {sideB.items_count} поз. · {formatQuantityLabel(sideB.total_quantity)}
            </p>
          )}
          {sideB.coins > 0 && (
            <p className="mt-0.5 whitespace-nowrap text-right text-[9px] text-amber-200/70">
              в т.ч. монеты: {formatPriceDots(sideB.coins)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className="bg-amber-400/70" style={{ width: `${Math.round(shareA * 100)}%` }} />
        <div className="flex-1 bg-accent/70" />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-600">
        <span>отдаю</span>
        <span>получаю</span>
      </div>

      <div className={clsx('mt-4 rounded-xl border px-3.5 py-3', TONE_STYLES[tone])}>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-80">Баланс</p>
        <p className="mt-1 font-display text-base font-semibold text-white">{title}</p>

        {hasContent && delta !== 0 && (
          <AutoFitText
            max={18}
            min={5}
            className="mt-1 font-display font-bold leading-tight"
            title={`${formatPriceDots(Math.abs(delta))} монет`}
          >
            {formatPriceDots(Math.abs(delta))}
            <span className="ml-1 font-sans text-[0.62em] font-medium uppercase tracking-wider opacity-80">
              монет
            </span>
          </AutoFitText>
        )}

        <p className="mt-2 text-[10px] leading-relaxed opacity-90">{hint}</p>
      </div>

      {hasContent && (ruleViolations > 0 || ruleWarnings > 0) && (
        <a
          href="#trade-rules"
          className={clsx(
            'mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed transition-colors',
            ruleViolations > 0
              ? 'border-rose-500/25 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.1]'
              : 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200 hover:bg-amber-400/[0.1]',
          )}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {ruleViolations > 0
              ? `Нарушения правил: ${ruleViolations}`
              : `Замечания по правилам: ${ruleWarnings}`}
            {ruleViolations > 0 && ruleWarnings > 0 ? ` · замечаний: ${ruleWarnings}` : ''}
            <span className="ml-1 underline decoration-dotted underline-offset-2">Подробнее</span>
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={onAlign}
        disabled={alignDisabledReason !== null}
        title={
          alignDisabledReason ??
          'Выровнять стоимости: добрать менее ценную сторону, а если мешает лимит количества — уменьшить более ценную'
        }
        className="btn btn-primary mt-3 w-full py-2 text-xs"
      >
        <Calculator className="h-3.5 w-3.5" aria-hidden />
        Посчитать минка к минке
      </button>

      {alignNote ? (
        <p
          role="status"
          className="mt-2 rounded-xl border border-accent/25 bg-accent/[0.07] px-3 py-2 text-[11px] leading-relaxed text-accent-300"
        >
          {alignNote}
        </p>
      ) : (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          Добирает количество в менее ценной стороне, округляя вверх: минимальные цены не нарушаются.
          Если добрать мешает лимит количества, уменьшает более ценную сторону до равноценности.
        </p>
      )}

      <button
        type="button"
        onClick={onClearAll}
        disabled={!hasContent}
        className="btn btn-danger mt-3 w-full py-2 text-xs"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Очистить всё
      </button>
    </section>
  );
}
