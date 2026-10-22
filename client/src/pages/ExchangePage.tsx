import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Boxes, Info, Layers, RefreshCw, Scale } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { GivePanel } from '../components/exchange/GivePanel';
import { ReceivePanel } from '../components/exchange/ReceivePanel';
import { ExchangeSummary } from '../components/exchange/ExchangeSummary';
import { ItemPickerModal } from '../components/trade/ItemPickerModal';
import { PageLoader } from '../components/ui/Spinner';
import { useCatalog } from '../hooks/useCatalog';
import {
  MAX_EXCHANGE_LINES,
  MAX_GIVE_QUANTITY,
  assembleExchange,
  clampGiveQuantity,
  loadExchangeState,
  saveExchangeState,
} from '../lib/exchange';
import type { Resource } from '../types';

export function ExchangePage() {
  const { resources, loading, error, reload } = useCatalog();

  const [resourceId, setResourceId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Обменник — McSkill Trader';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Восстанавливаем выбор один раз, когда каталог загружен: по пустому каталогу
  // нельзя проверить, что предмет ещё существует.
  useEffect(() => {
    if (hydrated || loading || resources.length === 0) return;

    const stored = loadExchangeState();

    if (stored) {
      if (stored.resourceId && resources.some((resource) => resource.id === stored.resourceId)) {
        setResourceId(stored.resourceId);
      }

      setQuantity(stored.quantity);
    }

    setHydrated(true);
  }, [hydrated, loading, resources]);

  useEffect(() => {
    if (!hydrated) return;
    saveExchangeState({ resourceId, quantity });
  }, [hydrated, resourceId, quantity]);

  const given = useMemo(
    () => (resourceId ? (resources.find((resource) => resource.id === resourceId) ?? null) : null),
    [resources, resourceId],
  );

  const givenTotal = useMemo(
    () => (given ? Math.round(given.min_price * quantity * 100) / 100 : 0),
    [given, quantity],
  );

  const result = useMemo(
    () =>
      given
        ? assembleExchange(givenTotal, resources, { excludeId: given.id, variant })
        : null,
    [given, givenTotal, resources, variant],
  );

  const handleQuantityChange = useCallback((next: number) => {
    setQuantity(clampGiveQuantity(next));
    // Другая сумма — другой набор: возвращаемся к самому точному варианту.
    setVariant(0);
  }, []);

  const handlePick = useCallback((resource: Resource) => {
    setResourceId(resource.id);
    setVariant(0);
    setPickerOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    setResourceId(null);
    setVariant(0);
  }, []);

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
              Обменник
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Что попросить за свой стак
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Укажите предмет и количество, которое отдаёте, — набор на вторую сторону подберётся
              сам по минимальным ценам, чтобы суммы сошлись минка к минке с допуском 10%.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Layers className="h-3 w-3 text-accent" aria-hidden />
                От 1 до {MAX_GIVE_QUANTITY} штук
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Boxes className="h-3 w-3 text-accent" aria-hidden />
                До {MAX_EXCHANGE_LINES} предметов в наборе
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <Scale className="h-3 w-3 text-accent" aria-hidden />
                Допуск 10% по п. 9.10
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                <ArrowLeftRight className="h-3 w-3 text-accent" aria-hidden />
                Подбор мгновенный
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
                <Boxes className="h-6 w-6 text-slate-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">Каталог пуст</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Добавьте ресурсы в админ-панели — после этого обменник сможет подбирать наборы.
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

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px_minmax(0,1fr)] lg:items-start">
                <GivePanel
                  className="order-1 min-w-0"
                  resource={given}
                  quantity={quantity}
                  total={givenTotal}
                  onQuantityChange={handleQuantityChange}
                  onPick={() => setPickerOpen(true)}
                  onClear={handleClear}
                />

                <ExchangeSummary
                  className="order-3 min-w-0 lg:order-2 lg:sticky lg:top-24"
                  givenTotal={givenTotal}
                  plan={result?.plan ?? null}
                />

                <ReceivePanel
                  className="order-2 min-w-0 lg:order-3"
                  result={result}
                  hasGiven={Boolean(given)}
                  onReroll={() => setVariant((current) => current + 1)}
                />
              </div>

              <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Набор считается по минимальным ценам каталога: одна и та же сумма может собираться
                несколькими способами — кнопка «Другой вариант» листает их. Предмет, который вы
                отдаёте, в набор не попадает. Если ни один набор не уложился в 10%, сделка может
                быть квалифицирована как неравноценный обмен (п. 9.10).
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
        open={pickerOpen}
        single
        sideTitle="Я отдаю"
        resources={resources}
        selectedIds={resourceId ? [resourceId] : []}
        onPick={handlePick}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
