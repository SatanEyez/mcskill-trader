import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useResourceFeed } from '../hooks/useResourceFeed';
import { useResourceStats } from '../hooks/useResourceStats';
import type { Resource, ResourceSort } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Hero } from '../components/home/Hero';
import { SearchControls } from '../components/home/SearchControls';
import { ResourceGrid } from '../components/home/ResourceGrid';
import { OnlineAdmins } from '../components/home/OnlineAdmins';
import { NewsBlock } from '../components/news/NewsBlock';
import { Pagination } from '../components/ui/Pagination';

const PAGE_SIZE = 36;

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
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

      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (loading || !location.hash) return;

    const id = location.hash.slice(1);
    const element = document.getElementById(id);

    if (element) {
      requestAnimationFrame(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading, location.hash, location.key]);

  const categories = useMemo(() => stats?.categories ?? [], [stats]);
  const hasFilters = searchInput.trim() !== '' || categoryId !== 'all';

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

  const totalResources = stats?.total ?? total;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <Hero
          resourceCount={totalResources}
          categoryCount={categories.length}
          minPrice={stats?.min_price ?? null}
          loading={statsLoading}
        />

        <NewsBlock />

        <div className="container-page">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <section id="resources" className="order-2 min-w-0 scroll-mt-24 xl:order-1">
              <SearchControls
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

            <aside className="order-1 min-w-0 xl:order-2 xl:sticky xl:top-24">
              <OnlineAdmins />
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
