import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, MessageSquareWarning, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useResourceFeed } from '../hooks/useResourceFeed';
import { useResourceStats } from '../hooks/useResourceStats';
import type { Resource, ResourceSort } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { SearchControls } from '../components/home/SearchControls';
import { ResourceGrid } from '../components/home/ResourceGrid';
import { OnlineAdmins } from '../components/home/OnlineAdmins';
import { Pagination } from '../components/ui/Pagination';
import { formatPrice, pluralize } from '../lib/format';

const PAGE_SIZE = 36;

export function ResourcesPage() {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useResourceStats();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [sort, setSort] = useState<ResourceSort>('name_asc');
  const [page, setPage] = useState(1);

  const searchRef = useRef<HTMLInputElement>(null);

  const { resources, total, pages, loading, error, reload } = useResourceFeed({
    search,
    categoryId: categoryId === 'all' ? '' : categoryId,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  useEffect(() => {
    document.title = 'Ресурсы — McSkill Trader';
    return () => {
      document.title = 'McSkill Trader';
    };
  }, []);

  // Поиск на сервере: не дёргаем API на каждую букву.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();

      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = useMemo(() => stats?.categories ?? [], [stats]);
  const hasFilters = searchInput.trim() !== '' || categoryId !== 'all';
  const totalResources = stats?.total ?? total;

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setCategoryId('all');
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setCategoryId(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((value: ResourceSort) => {
    setSort(value);
    setPage(1);
  }, []);

  const handleUseInCalculator = useCallback(
    (resource: Resource) => {
      navigate(`/trade?add=${encodeURIComponent(resource.id)}`);
    },
    [navigate],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/[0.05] pb-8 pt-10 sm:pt-12">
          <div
            className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-50"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-24 left-1/3 h-56 w-[36rem] rounded-full bg-accent/[0.07] blur-[100px]"
            aria-hidden
          />

          <div className="container-page relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Каталог
            </p>
            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold text-white sm:text-3xl">
              <Boxes className="h-6 w-6 text-accent" aria-hidden />
              Ресурсы
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Все предметы сервера с минимальными ценами. Нажмите на карточку — предмет сразу
              попадёт в трейд-калькулятор.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-slate-400">
                {statsLoading ? '…' : `${totalResources} ${pluralize(totalResources, ['предмет', 'предмета', 'предметов'])}`}
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-slate-400">
                {statsLoading ? '…' : `${categories.length} ${pluralize(categories.length, ['категория', 'категории', 'категорий'])}`}
              </span>
              {stats?.min_price != null && (
                <span className="rounded-full border border-accent/25 bg-accent/[0.07] px-3 py-1 text-accent">
                  минималка от {formatPrice(stats.min_price)} монет
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="container-page py-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <section id="resources" className="min-w-0 scroll-mt-24">
              <SearchControls
                title="Все предметы"
                search={searchInput}
                onSearchChange={setSearchInput}
                categoryId={categoryId}
                onCategoryChange={handleCategoryChange}
                categories={categories}
                total={totalResources}
                sort={sort}
                onSortChange={handleSortChange}
                filteredCount={total}
                searchRef={searchRef}
              />

              {error && resources.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
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

              {error && !loading && resources.length === 0 ? (
                <div className="mt-5 flex flex-col items-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-6 py-14 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
                    <AlertTriangle className="h-6 w-6 text-rose-300" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    Не удалось загрузить каталог
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="btn btn-primary mt-5"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Попробовать снова
                  </button>
                </div>
              ) : (
                <>
                  <ResourceGrid
                    resources={resources}
                    loading={loading}
                    hasFilters={hasFilters}
                    onUse={handleUseInCalculator}
                    onResetFilters={resetFilters}
                  />
                  <Pagination
                    page={page}
                    pages={pages}
                    total={total}
                    onPageChange={setPage}
                    disabled={loading}
                  />
                </>
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
              <OnlineAdmins />

              <div className="panel p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                  <MessageSquareWarning className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-3 text-sm font-semibold text-white">Не нашли предмет?</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  Напишите администрации — предмет добавят в каталог и посчитают минимальную цену.
                </p>
                <Link to="/report" className="btn btn-secondary mt-4 w-full py-2 text-xs">
                  Сообщить о проблеме
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
