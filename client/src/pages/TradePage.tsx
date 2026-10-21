import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Coins, Info, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { TradeSide } from '../components/trade/TradeSide';
import { TradeSummary } from '../components/trade/TradeSummary';
import { TradeRulesPanel } from '../components/trade/TradeRulesPanel';
import { ItemPickerModal } from '../components/trade/ItemPickerModal';
import { PageLoader } from '../components/ui/Spinner';
import { useCatalog } from '../hooks/useCatalog';
import {
  MAX_TRADE_LINES,
  TRADE_STORAGE_KEY,
  addLine,
  alignMinToMin,
  calculateTradeLocal,
  loadTradeState,
  pruneTradeState,
  removeLine,
  saveTradeState,
  setLineQuantity,
  toggleLine,
  type TradeSide as TradeSideKey,
  type TradeState,
} from '../lib/trade';
import { formatPriceDots, formatQuantityDots } from '../lib/format';
import { checkTradeRules } from '../lib/trade-rules';
import type { Resource } from '../types';

const EMPTY_STATE: TradeState = { sideA: [], sideB: [], coinsA: 0, coinsB: 0 };

const SIDE_TITLES: Record<TradeSideKey, string> = {
  a: 'Я отдаю',
  b: 'Я получаю',
};

export function TradePage() {
  const { resources, loading, error, reload } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const [state, setState] = useState<TradeState>(EMPTY_STATE);
  const [pickerSide, setPickerSide] = useState<TradeSideKey | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [alignNote, setAlignNote] = useState<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Трейд-калькулятор — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Восстанавливаем сохранённые списки один раз, когда каталог загружен.
  useEffect(() => {
    // Пустой каталог — это ошибка загрузки или пустая база: prune по пустому списку
    // стёр бы сохранённый трейд, поэтому ждём реальные данные.
    if (hydrated || loading || resources.length === 0) return;

    const stored = loadTradeState();
    if (stored) setState(pruneTradeState(stored, resources));
    setHydrated(true);
  }, [hydrated, loading, resources]);

  useEffect(() => {
    if (!hydrated) return;
    saveTradeState(state);
  }, [hydrated, state]);

  // Переход из каталога «В трейд-калькулятор»: ?add=<id> добавляет предмет
  // в сторону «Я отдаю» и сразу очищает параметр, чтобы обновление страницы
  // не добавляло его повторно.
  useEffect(() => {
    if (!hydrated) return;

    const addId = searchParams.get('add');
    if (!addId) return;

    if (resources.some((resource) => resource.id === addId)) {
      setState((current) => ({ ...current, sideA: addLine(current.sideA, addId) }));
      setAlignNote('Предмет добавлен в «Я отдаю». Укажите количество и заполните вторую сторону.');
    }

    setSearchParams({}, { replace: true });
  }, [hydrated, resources, searchParams, setSearchParams]);

  // Вкладки одного браузера делят localStorage. Подхватываем правки соседней вкладки,
  // чтобы списки не расходились и последняя запись не затирала чужой трейд молча.
  useEffect(() => {
    if (!hydrated) return;

    const knownIds = new Set(resources.map((resource) => resource.id));

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TRADE_STORAGE_KEY) return;

      const next = loadTradeState();
      if (!next) return;

      // Каталог этой вкладки мог устареть (например, админ только что добавил предмет):
      // не применяем состояние частично, иначе строки пропадут из вида.
      const compatible = [...next.sideA, ...next.sideB].every((line) =>
        knownIds.has(line.resourceId),
      );
      if (!compatible) return;

      setAlignNote(null);
      setState(next);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [hydrated, resources]);

  const calculation = useMemo(
    () => calculateTradeLocal(state.sideA, state.sideB, resources, state.coinsA, state.coinsB),
    [state.sideA, state.sideB, state.coinsA, state.coinsB, resources],
  );

  const rulesReport = useMemo(
    () => checkTradeRules(calculation, resources),
    [calculation, resources],
  );

  const updateSide = useCallback(
    (side: TradeSideKey, updater: (lines: TradeState['sideA']) => TradeState['sideA']) => {
      // Ручная правка отменяет подсказку о прошлом выравнивании.
      setAlignNote(null);
      setState((current) =>
        side === 'a'
          ? { ...current, sideA: updater(current.sideA) }
          : { ...current, sideB: updater(current.sideB) },
      );
    },
    [],
  );

  const handlePick = useCallback(
    (resource: Resource) => {
      if (!pickerSide) return;
      // Повторное нажатие по уже выбранной строке снимает выбор.
      setAlignNote(null);
      updateSide(pickerSide, (lines) => toggleLine(lines, resource.id));
    },
    [pickerSide, updateSide],
  );

  const handleCoinsChange = useCallback((side: TradeSideKey, coins: number) => {
    setAlignNote(null);
    setState((current) =>
      side === 'a' ? { ...current, coinsA: coins } : { ...current, coinsB: coins },
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setAlignNote(null);
    setState(EMPTY_STATE);
  }, []);

  const handleClearSide = useCallback((side: TradeSideKey) => {
    setAlignNote(null);
    setState((current) =>
      side === 'a'
        ? { ...current, sideA: [], coinsA: 0 }
        : { ...current, sideB: [], coinsB: 0 },
    );
  }, []);

  const hasItems = state.sideA.length > 0 || state.sideB.length > 0;
  const hasContent = hasItems || state.coinsA > 0 || state.coinsB > 0;
  const hasBothSides =
    (state.sideA.length > 0 || state.coinsA > 0) && (state.sideB.length > 0 || state.coinsB > 0);
  const minToMin = useMemo(() => alignMinToMin(state, resources), [state, resources]);

  /** «Минка к минке»: добираем количество в менее ценной стороне. */
  const handleAlign = useCallback(() => {
    const plan = alignMinToMin(state, resources);
    if (!plan || !plan.changed) return;

    setState((current) =>
      plan.side === 'b' ? { ...current, sideB: plan.lines } : { ...current, sideA: plan.lines },
    );

    const details = plan.changes
      .map(
        (change) =>
          `${change.name}: ${formatQuantityDots(change.from)} → ${formatQuantityDots(change.to)} шт.`,
      )
      .join(' · ');

    setAlignNote(
      `${plan.side === 'b' ? '«Я получаю»' : '«Я отдаю»'} ` +
        `${plan.mode === 'reduce' ? 'уменьшено до равноценности' : 'выровнено по минке'}: ${details} · ` +
        `стоимость стороны — ${formatPriceDots(plan.total)} монет.`,
    );
  }, [state, resources]);

  const alignDisabledReason = !hasItems
    ? 'Сначала добавьте предметы в обе стороны'
    : state.sideA.length === 0 || state.sideB.length === 0
      ? 'Заполните обе стороны предметами — монеты выравнивать не нужно'
      : !minToMin
        ? 'Нужны предметы с минимальной ценой больше нуля'
        : !minToMin.changed
          ? minToMin.mode === 'reduce'
            ? 'Разница слишком велика — уменьшать количество дальше нельзя'
            : 'Стороны уже выровнены по минке — точнее целыми штуками не получится'
          : null;

  const pickerLines = pickerSide === 'b' ? state.sideB : state.sideA;
  const catalogEmpty = !loading && resources.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/[0.04] pb-10 pt-12 sm:pt-14">
          <div className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[110px]"
            aria-hidden
          />

          <div className="container-page relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Трейд-калькулятор
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Соберите обе стороны обмена
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Добавьте предметы и монеты в оба списка — калькулятор посчитает стоимость сторон по
              минимальным ценам сервера и покажет, кому положена доплата.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Sparkles className="h-3 w-3 text-accent" aria-hidden />
                До {MAX_TRADE_LINES} предметов на сторону
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Coins className="h-3 w-3 text-accent" aria-hidden />
                Расчёт по минималкам
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Calculator className="h-3 w-3 text-accent" aria-hidden />
                Минка к минке в один клик
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Save className="h-3 w-3 text-accent" aria-hidden />
                Списки сохраняются в браузере
              </span>
            </div>
          </div>
        </section>

        <div className="container-page py-8 sm:py-10">
          {loading ? (
            <PageLoader label="Загружаем каталог…" />
          ) : error && resources.length === 0 ? (
            <div className="panel flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.08]">
                <AlertTriangle className="h-6 w-6 text-rose-300" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">Не удалось загрузить каталог</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : catalogEmpty ? (
            <div className="panel flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <Coins className="h-6 w-6 text-slate-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">Каталог пуст</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Добавьте ресурсы в админ-панели — после этого их можно будет собрать в обмен.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {error}
                  </span>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Повторить
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)] lg:items-start">
                <TradeSide
                  className="order-1 min-w-0"
                  tone="a"
                  title={SIDE_TITLES.a}
                  hint="Предметы и монеты, которые уходят из вашего инвентаря"
                  lines={state.sideA}
                  resources={resources}
                  total={calculation.side_a.total}
                  itemsTotal={calculation.side_a.items_total}
                  coins={state.coinsA}
                  totalQuantity={calculation.side_a.total_quantity}
                  onAdd={() => setPickerSide('a')}
                  onCoinsChange={(coins) => handleCoinsChange('a', coins)}
                  onQuantityChange={(id, quantity) =>
                    updateSide('a', (lines) => setLineQuantity(lines, id, quantity))
                  }
                  onRemove={(id) => updateSide('a', (lines) => removeLine(lines, id))}
                  onClear={() => handleClearSide('a')}
                />

                <TradeSummary
                  className="order-3 min-w-0 lg:order-2 lg:sticky lg:top-24"
                  result={calculation}
                  hasContent={hasContent}
                  alignDisabledReason={alignDisabledReason}
                  alignNote={alignNote}
                  onAlign={handleAlign}
                  onClearAll={handleClearAll}
                  ruleViolations={rulesReport.violations}
                  ruleWarnings={rulesReport.warnings}
                />

                <TradeSide
                  className="order-2 min-w-0 lg:order-3"
                  tone="b"
                  title={SIDE_TITLES.b}
                  hint="Предметы и монеты, которые вы получаете взамен"
                  lines={state.sideB}
                  resources={resources}
                  total={calculation.side_b.total}
                  itemsTotal={calculation.side_b.items_total}
                  coins={state.coinsB}
                  totalQuantity={calculation.side_b.total_quantity}
                  onAdd={() => setPickerSide('b')}
                  onCoinsChange={(coins) => handleCoinsChange('b', coins)}
                  onQuantityChange={(id, quantity) =>
                    updateSide('b', (lines) => setLineQuantity(lines, id, quantity))
                  }
                  onRemove={(id) => updateSide('b', (lines) => removeLine(lines, id))}
                  onClear={() => handleClearSide('b')}
                />
              </div>

              <TradeRulesPanel
                report={rulesReport}
                hasContent={hasContent}
                hasBothSides={hasBothSides}
                className="mt-4"
              />

              <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Расчёт справочный: суммы округляются до сотых, цены берутся из каталога минималок.
                Монеты входят в стоимость стороны и учитываются в доплате. Кнопка «минка к минке»
                добирает количество в менее ценной стороне и всегда округляет его вверх, чтобы
                минимальные цены не нарушались. Списки хранятся только в вашем браузере.
              </p>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-100/85">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
                <p>
                  Сайт не является официальным и никак не принадлежит управлению проекта McSkill.
                  Цены могут изменяться без ведома администрации этого сайта — пожалуйста, внимательно
                  смотрите на минималку в игре и на нашем сайте.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

      <ItemPickerModal
        open={pickerSide !== null}
        sideTitle={pickerSide ? SIDE_TITLES[pickerSide] : ''}
        resources={resources}
        selectedIds={pickerLines.map((line) => line.resourceId)}
        onPick={handlePick}
        onClose={() => setPickerSide(null)}
      />
    </div>
  );
}
