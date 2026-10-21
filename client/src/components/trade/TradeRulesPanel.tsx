import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import type { TradeRulesReport } from '../../lib/trade-rules';

interface TradeRulesPanelProps {
  report: TradeRulesReport;
  /** Есть предметы или монеты хотя бы с одной стороны. */
  hasContent: boolean;
  /** Заполнены обе стороны — только тогда сделку можно проверить целиком. */
  hasBothSides: boolean;
  className?: string;
}

const SEVERITY_STYLES = {
  violation: {
    box: 'border-rose-500/25 bg-rose-500/[0.06]',
    icon: 'text-rose-300',
    chip: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    label: 'Нарушение',
  },
  warning: {
    box: 'border-amber-400/25 bg-amber-400/[0.06]',
    icon: 'text-amber-300',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    label: 'Внимание',
  },
} as const;

export function TradeRulesPanel({
  report,
  hasContent,
  hasBothSides,
  className,
}: TradeRulesPanelProps) {
  const total = report.violations + report.warnings;

  return (
    <section
      id="trade-rules"
      aria-labelledby="trade-rules-title"
      className={clsx('panel scroll-mt-24 p-4 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={clsx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
            total > 0
              ? 'border-rose-500/25 bg-rose-500/[0.08] text-rose-300'
              : 'border-accent/20 bg-accent/[0.07] text-accent',
          )}
        >
          {total > 0 ? (
            <ShieldAlert className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
        </span>

        <div className="min-w-0">
          <h2 id="trade-rules-title" className="text-sm font-semibold text-white">
            Проверка по правилам экономики
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Пункты 9.6, 9.7, 9.9–9.11</p>
        </div>

        {total > 0 && (
          <span
            className={clsx(
              'ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
              report.violations > 0
                ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                : 'border-amber-400/30 bg-amber-400/10 text-amber-200',
            )}
          >
            {report.violations > 0
              ? `Нарушений: ${report.violations}`
              : `Замечаний: ${report.warnings}`}
          </span>
        )}
      </div>

      <div className="mt-4" aria-live="polite">
        {!hasContent ? (
          <p className="rounded-xl border border-dashed border-white/[0.08] px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
            Добавьте предметы или монеты в обе стороны — проверим сделку по правилам экономики.
          </p>
        ) : total === 0 && !hasBothSides ? (
          <p className="rounded-xl border border-dashed border-amber-400/20 bg-amber-400/[0.03] px-3.5 py-3 text-[11px] leading-relaxed text-slate-400">
            Пока заполнена только одна сторона. Добавьте встречные предметы или монеты — проверим
            равноценность обмена и запрет на раздачу.
          </p>
        ) : total === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/[0.05] px-3.5 py-3">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <p className="text-[11px] leading-relaxed text-slate-300/90">
              <span className="font-semibold text-accent">Нарушений не найдено.</span> Оценка идёт по
              минимальным ценам, запрещённых к раздаче предметов нет, лёгкие и труднодоступные
              ресурсы не смешаны.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {report.notices.map((notice) => {
              const styles = SEVERITY_STYLES[notice.severity];

              return (
                <li
                  key={notice.id}
                  className={clsx('rounded-xl border px-3.5 py-3', styles.box)}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={clsx('mt-0.5 h-3.5 w-3.5 shrink-0', styles.icon)}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                            styles.chip,
                          )}
                        >
                          п. {notice.rule} · {styles.label}
                        </span>
                        <span className="text-xs font-semibold text-white">{notice.title}</span>
                      </div>

                      <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-300/90">
                        {notice.message}
                      </p>

                      {notice.items.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 break-words text-[11px] leading-relaxed text-slate-400">
                          {notice.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 border-t border-white/[0.05] pt-3 text-[10px] leading-relaxed text-slate-600">
        Всегда проверяются п. 9.6 (цена в пределах минималки и потолка ×10/×5/×2) и п. 9.9 (оценка
        по минимальной цене). В сделках от 1 млн монет разница до 10 000 монет считается
        равноценностью. Классификация лёгких и труднодоступных предметов ведётся по названию:
        спорные позиции уточняйте у состава сервера.
      </p>
    </section>
  );
}
