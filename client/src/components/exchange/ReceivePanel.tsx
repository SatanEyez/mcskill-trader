import type { ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Filter, PackageSearch, Shuffle, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { categoryStyle } from '../../lib/constants';
import { readableNameColor } from '../../lib/color';
import { formatPriceDots, formatQuantityDots, pluralize } from '../../lib/format';
import { formatGapPercent } from '../../lib/trade-rules';
import type { CategoryOption } from '../../lib/categories';
import {
  EXCHANGE_OPTIONS_PER_PAGE,
  type ExchangeResult,
} from '../../lib/exchange';
import { AutoFitText } from '../ui/AutoFitText';
import { ItemImage } from '../ui/ItemImage';

interface ReceivePanelProps {
  result: ExchangeResult | null;
  /** Есть ли предмет на стороне «отдаю» — от этого зависит текст пустого состояния. */
  hasGiven: boolean;
  /** Индекс выбранного варианта на текущей странице. */
  selected: number;
  onSelect: (index: number) => void;
  onReroll: () => void;
  /** Категории каталога для фильтра вариантов. */
  categories: CategoryOption[];
  /** Активная категория; `null` — все категории. */
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  className?: string;
}

export function ReceivePanel({
  result,
  hasGiven,
  selected,
  onSelect,
  onReroll,
  categories,
  categoryId,
  onCategoryChange,
  className,
}: ReceivePanelProps) {
  const options = result?.options ?? [];
  const active = options[selected] ?? null;
  const activeItem = active?.items[0] ?? null;

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
            До {EXCHANGE_OPTIONS_PER_PAGE} вариантов · один предмет и 1–64 шт.
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-[10px] font-semibold text-accent">
          {result ? `${result.total} ${pluralize(result.total, ['вариант', 'варианта', 'вариантов'])}` : '0'}
        </span>
      </div>

      {categories.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Filter className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <select
              value={categoryId ?? 'all'}
              onChange={(event) =>
                onCategoryChange(event.target.value === 'all' ? null : event.target.value)
              }
              className={clsx(
                'w-full appearance-none truncate rounded-lg border bg-white/[0.02] py-1 pl-2 pr-6 text-[10px] outline-none transition',
                'hover:border-white/15 hover:text-slate-200 focus:border-accent/40 focus:text-slate-100',
                categoryId
                  ? 'border-accent/30 text-accent-300'
                  : 'border-white/[0.06] text-slate-500',
              )}
              title="Показывать варианты только из выбранной категории"
              aria-label="Категория вариантов"
            >
              <option value="all">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600"
              aria-hidden
            />
          </div>
        </div>
      )}

      <div className="mt-3 border-b border-white/[0.05] pb-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <AutoFitText
            max={24}
            min={8}
            className="min-w-0 flex-1 font-display font-semibold text-white"
            title={`${formatPriceDots(active?.total ?? 0)} монет`}
          >
            {formatPriceDots(active?.total ?? 0)}
          </AutoFitText>
          <span className="shrink-0 text-[11px] text-slate-500">монет</span>
        </div>

        {activeItem ? (
          <p className="mt-1 flex flex-wrap items-center justify-end gap-x-1 text-[10px] text-slate-500">
            <span
              className="max-w-[13rem] truncate font-medium text-slate-400"
              title={activeItem.resource.name}
              style={{ color: readableNameColor(activeItem.resource.name_color) }}
            >
              {activeItem.resource.name}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              {formatQuantityDots(activeItem.quantity)}{' '}
              {pluralize(activeItem.quantity, ['штука', 'штуки', 'штук'])}
            </span>
            <span className="text-slate-600">·</span>
            <span className={active?.ok ? 'text-accent-300' : 'text-amber-200/80'}>
              разница {formatGapPercent(active?.signedGapPercent ?? 0)}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-right text-[10px] text-slate-500">
            Выберите вариант из списка ниже
          </p>
        )}
      </div>

      {!hasGiven ? (
        <EmptyState
          icon={<PackageSearch className="h-7 w-7 text-slate-600" aria-hidden />}
          title="Пока нечего подбирать"
          text="Укажите предмет и количество слева — варианты появятся здесь сразу."
        />
      ) : options.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7 text-amber-300/70" aria-hidden />}
          title="Варианты не нашлись"
          text="Подходящих по цене предметов нет. Уменьшите количество, выберите предмет подешевле или проверьте, что у него указана минимальная цена."
        />
      ) : (
        <ul className="mt-3 flex-1 space-y-1.5">
          {options.map((plan, index) => {
            const item = plan.items[0];
            if (!item) return null;

            const isSelected = index === selected;

            return (
              <li key={item.resource.id}>
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-pressed={isSelected}
                  title={`Выбрать вариант: ${item.resource.name} × ${item.quantity}`}
                  className={clsx(
                    'w-full rounded-xl border p-2 text-left transition',
                    isSelected
                      ? 'border-accent/45 bg-accent/[0.07] shadow-[0_0_0_1px_rgba(52,211,153,0.12)]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.035]',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                      <ItemImage
                        src={item.resource.image_url}
                        alt={item.resource.name}
                        className="h-9 w-9"
                      />
                      <span className="absolute -bottom-1.5 -right-1.5 rounded-md border border-accent/30 bg-[#07110d] px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-300 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                        ×{formatQuantityDots(item.quantity)}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[13px] font-medium text-slate-100"
                        style={{ color: readableNameColor(item.resource.name_color) }}
                        title={item.resource.name}
                      >
                        {item.resource.name}
                      </p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span
                          className={clsx(
                            'inline-flex max-w-[7rem] truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
                            categoryStyle(item.resource.category),
                          )}
                        >
                          {item.resource.category}
                        </span>
                        <span className="truncate text-[10px] text-slate-500">
                          {formatPriceDots(item.unitPrice)} / шт.
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-display text-xs font-semibold text-accent-300">
                        {formatPriceDots(plan.total)}
                      </p>
                      <p
                        className={clsx(
                          'mt-0.5 text-[10px] tabular-nums',
                          plan.ok ? 'text-slate-500' : 'text-amber-200/80',
                        )}
                      >
                        {formatGapPercent(plan.signedGapPercent)}
                      </p>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onReroll}
          disabled={!result || result.pages < 2}
          className="btn btn-secondary flex-1 px-3 py-2 text-xs"
          title={
            result && result.pages >= 2
              ? 'Показать следующие варианты'
              : 'Других вариантов на эту сумму нет'
          }
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden />
          Другой вариант
        </button>

        {result && result.pages > 1 && (
          <span className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-[10px] font-medium tabular-nums text-slate-500">
            {result.page + 1} / {result.pages}
          </span>
        )}
      </div>

      {result && result.validTotal === 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200/80">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Ни один вариант не уложился в 10%. Показаны самые близкие — такую сделку могут
          посчитать неравноценной.
        </p>
      )}

      {result && result.validTotal > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" aria-hidden />
          {result.validTotal} {pluralize(result.validTotal, ['вариант', 'варианта', 'вариантов'])}{' '}
          в допуске 10%. Нажмите на карточку, чтобы подставить её в «Итог».
        </p>
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
