import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  Calculator,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { formatPriceDots } from '../../lib/format';

/**
 * Живое превью трейда вместо гифки.
 *
 * Зациклено, как гифка, но остаётся векторным: чёткое на любом экране
 * и весит ноль килобайт.
 *
 * `prefers-reduced-motion` не выключает показ: Chrome на Windows берёт эту
 * настройку из системы и в отличие от Opera отдаёт `reduce`, из-за чего
 * превью раньше замирало на последнем кадре. Теперь в этом режиме кадры
 * всё равно сменяются, но «спокойно» — без сдвигов и масштабирования,
 * только по прозрачности и медленнее. Пауза доступна всегда.
 */

interface DemoItem {
  name: string;
  qty: number;
  price: number;
  icon: string;
}

const GIVE: DemoItem[] = [
  { name: 'Элитры', qty: 1, price: 26_000, icon: '/items/elytra.png' },
  { name: 'Незерит', qty: 16, price: 18_240, icon: '/items/netherite_ingot.png' },
];

const RECEIVE: DemoItem[] = [
  { name: 'Звезда', qty: 3, price: 42_000, icon: '/items/nether_star.png' },
  { name: 'Тотем', qty: 1, price: 7_500, icon: '/items/totem_of_undying.png' },
];

const TOTAL_GIVE = GIVE.reduce((sum, item) => sum + item.price, 0);
const TOTAL_RECEIVE = RECEIVE.reduce((sum, item) => sum + item.price, 0);
const TOTAL_SUM = TOTAL_GIVE + TOTAL_RECEIVE;
const GAP = Math.abs(TOTAL_RECEIVE - TOTAL_GIVE);
const GAP_PERCENT = (GAP / TOTAL_SUM) * 100;
const SHARE_GIVE = TOTAL_GIVE / TOTAL_SUM;
const GAP_TEXT = `${GAP_PERCENT.toFixed(1).replace('.', ',')}%`;

/** Кадры: пусто → по предмету в каждой стороне → итоги → вердикт. */
const LAST_STEP = 5;
const STEP_MS = 760;
const HOLD_MS = 2800;
/** Спокойный режим: без движения и медленнее, чтобы не «дёргать» глаз. */
const CALM_STEP_MS = 1500;
const CALM_HOLD_MS = 4200;

const CAPTIONS = [
  'Выберите предметы в каталоге',
  'Калькулятор считает по минимальным ценам',
  'Обмен верный — можно торговать',
];

function PreviewSide({
  label,
  tone,
  items,
  total,
  visibleFrom,
  totalsVisible,
  calm,
  step,
}: {
  label: string;
  tone: 'give' | 'receive';
  items: DemoItem[];
  total: number;
  visibleFrom: number;
  totalsVisible: boolean;
  calm: boolean;
  step: number;
}) {
  const visibleCount = Math.max(0, Math.min(items.length, step - visibleFrom + 1));
  const hasItems = visibleCount > 0;

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/[0.06] bg-white/[0.015] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            tone === 'give' ? 'bg-amber-400/80' : 'bg-accent/80',
          )}
          aria-hidden
        />
      </div>

      <div className="relative mt-2 flex min-h-[76px] flex-col gap-1.5">
        {items.map((item, index) => {
          const visible = index < visibleCount;

          return (
            <div
              key={item.name}
              className={clsx(
                'flex items-center gap-2 rounded-lg border px-1.5 py-1 transition-all duration-500 ease-out',
                visible
                  ? 'translate-y-0 scale-100 border-white/[0.07] bg-white/[0.03] opacity-100'
                  : calm
                    ? 'border-transparent bg-transparent opacity-0'
                    : 'translate-y-1.5 scale-95 border-transparent bg-transparent opacity-0',
              )}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-void/60 p-1">
                <img
                  src={item.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pixelated h-full w-full object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-medium leading-tight text-slate-200">
                  {item.name}
                  <span className="ml-1 text-[9px] font-normal text-slate-500">×{item.qty}</span>
                </span>
              </span>
              <span className="hidden shrink-0 font-display text-[9.5px] font-medium tabular-nums text-slate-300 sm:block">
                {formatPriceDots(item.price)}
              </span>
            </div>
          );
        })}

        {!hasItems && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/[0.08] text-center">
            <Plus className="h-3.5 w-3.5 text-slate-600" aria-hidden />
            <span className="text-[9px] leading-tight text-slate-600">
              Добавьте
              <br />
              предметы
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-1 border-t border-white/[0.06] pt-2">
        <span className="text-[8.5px] uppercase tracking-[0.14em] text-slate-600">итого</span>
        <span
          className={clsx(
            'font-display text-[11px] font-semibold tabular-nums transition-all duration-500',
            totalsVisible ? 'text-white opacity-100' : 'text-slate-600 opacity-50',
          )}
        >
          {totalsVisible ? formatPriceDots(total) : '—'}
        </span>
      </div>
    </div>
  );
}

export function TradePreview() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Сразу с верным значением, иначе первый кадр успевает получить сдвиг/масштаб.
  const [calm, setCalm] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setCalm(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!playing) return;

    const timer = window.setTimeout(
      () => setStep((current) => (current >= LAST_STEP ? 0 : current + 1)),
      step >= LAST_STEP ? (calm ? CALM_HOLD_MS : HOLD_MS) : calm ? CALM_STEP_MS : STEP_MS,
    );

    return () => window.clearTimeout(timer);
  }, [step, playing, calm]);

  const totalsVisible = step >= 4;
  const ready = step >= LAST_STEP;
  const phase = step === 0 ? 0 : ready ? 2 : 1;

  return (
    <figure
      className="trade-preview relative m-0"
      aria-label="Демонстрация работы трейд-калькулятора: предметы добавляются в обе стороны, калькулятор считает разницу, обмен признаётся верным"
    >
      <div
        className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-accent/[0.07] blur-3xl"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-b from-panel to-abyss p-1 shadow-card">
        <div className="relative overflow-hidden rounded-[1.05rem] border border-white/[0.05] bg-void/70 p-3">
          <div
            className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
          />

          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-accent/25 bg-accent/10 text-accent">
                <Calculator className="h-3 w-3" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold leading-tight text-white">
                  Трейд-калькулятор
                </p>
                <p className="text-[9px] leading-tight text-slate-500">
                  так проходит сделка
                </p>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <span className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[8.5px] uppercase tracking-[0.12em] text-slate-500 sm:inline-flex">
                  <span className="h-1 w-1 rounded-full bg-rose-400" aria-hidden />
                  демо
                </span>

                <button
                  type="button"
                  onClick={() => setPlaying((current) => !current)}
                  className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:border-accent/30 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  aria-label={playing ? 'Остановить анимацию' : 'Запустить анимацию'}
                  title={playing ? 'Остановить анимацию' : 'Запустить анимацию'}
                >
                  {playing ? (
                    <Pause className="h-3 w-3" aria-hidden />
                  ) : (
                    <Play className="h-3 w-3" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <PreviewSide
                label="Я отдаю"
                tone="give"
                items={GIVE}
                total={TOTAL_GIVE}
                visibleFrom={1}
                totalsVisible={totalsVisible}
                calm={calm}
                step={step}
              />
              <PreviewSide
                label="Я получаю"
                tone="receive"
                items={RECEIVE}
                total={TOTAL_RECEIVE}
                visibleFrom={3}
                totalsVisible={totalsVisible}
                calm={calm}
                step={step}
              />
            </div>

            <div
              className={clsx(
                'mt-2 rounded-xl border px-2.5 py-2 transition-colors duration-500',
                ready
                  ? 'border-accent/30 bg-accent/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.02]',
              )}
            >
              <div className="flex items-center gap-1.5">
                {ready ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                ) : (
                  <Scale
                    className={clsx(
                      'h-3.5 w-3.5 shrink-0',
                      totalsVisible ? 'animate-pulse-soft text-slate-400' : 'text-slate-600',
                    )}
                    aria-hidden
                  />
                )}

                <span
                  className={clsx(
                    'truncate text-[11px] font-semibold transition-colors duration-500',
                    ready ? 'text-accent-300' : 'text-slate-400',
                  )}
                >
                  {ready
                    ? 'Обмен верный'
                    : totalsVisible
                      ? 'Считаем разницу…'
                      : 'Ожидаем предметы'}
                </span>

                <span
                  className={clsx(
                    'ml-auto shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[8.5px] font-semibold transition-all duration-500',
                    ready
                      ? 'border-accent/40 bg-accent/[0.12] text-accent opacity-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-600 opacity-0',
                  )}
                >
                  разница {GAP_TEXT} · порог 10%
                </span>
              </div>

              <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                <div
                  className="bg-amber-400/70 transition-[width] duration-700 ease-out"
                  style={{ width: `${(totalsVisible ? SHARE_GIVE : 0.5) * 100}%` }}
                />
                <div
                  className={clsx(
                    'flex-1 bg-accent/70 transition-opacity duration-700',
                    totalsVisible ? 'opacity-100' : 'opacity-20',
                  )}
                />
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex shrink-0 gap-1" aria-hidden>
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={clsx(
                      'h-1 rounded-full transition-all duration-300',
                      index === phase ? 'w-4 bg-accent' : 'w-1 bg-white/15',
                    )}
                  />
                ))}
              </div>
              <p className="truncate text-[9.5px] text-slate-500">{CAPTIONS[phase]}</p>
            </div>

            {/* Бейджи проверенных правил — как в настоящем трейде */}
            <div
              className={clsx(
                'mt-2 flex flex-wrap gap-1.5 transition-all duration-500',
                ready ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden={!ready}
            >
              {[
                { rule: '9.6', text: 'Цены по минималке' },
                { rule: '9.10', text: `Разница ${GAP_TEXT} · порог 10%` },
                { rule: '9.11', text: 'Нет запретных обменов' },
              ].map((badge) => (
                <span
                  key={badge.rule}
                  className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-accent"
                >
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                  п. {badge.rule} · {badge.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
