import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Newspaper, RefreshCw, Sparkles } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { NewsCard, NewsFeaturedCard } from '../components/news/NewsCard';
import { Pagination } from '../components/ui/Pagination';
import { PageLoader } from '../components/ui/Spinner';
import { useNews } from '../hooks/useNews';
import { formatDateMsk } from '../lib/format';

const PAGE_SIZE = 9;

export function NewsPage() {
  const [page, setPage] = useState(1);
  const { posts, total, loading, error, reload } = useNews(PAGE_SIZE, (page - 1) * PAGE_SIZE);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const featured = posts[0];
  const rest = posts.slice(1);
  const latestDate = posts[0]?.published_at ?? posts[0]?.created_at;

  useEffect(() => {
    document.title = 'Новости — McSkill Trader';
    return () => {
      document.title = 'McSkill Trader';
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/[0.05]">
          <div className="pointer-events-none absolute inset-0 bg-hero-glow" aria-hidden />
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/[0.07] blur-3xl"
            aria-hidden
          />

          <div className="container-page relative py-10 sm:py-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Лента проекта
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[44px]">
                  Новости <span className="text-accent">McSkill</span>
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
                  Обновления каталога, изменения цен и объявления администрации сервера McSkill OneBlock.
                </p>
              </div>

              {total > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  <div className="panel flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent-300">
                      <Newspaper className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-display text-lg leading-none text-white">{total}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        публикаций
                      </span>
                    </span>
                  </div>

                  {page === 1 && latestDate && (
                    <div className="panel flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent-300">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold leading-none text-white">
                          {formatDateMsk(latestDate)}
                        </span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          свежее обновление
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="container-page py-8 sm:py-10">
          {error && posts.length > 0 && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void reload()}
                className="btn btn-secondary px-3 py-1.5 text-xs"
              >
                Повторить
              </button>
            </div>
          )}

          {loading && posts.length === 0 ? (
            <PageLoader label="Загружаем новости…" />
          ) : error && posts.length === 0 ? (
            <div className="panel flex flex-col items-center px-6 py-16 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить новости</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="panel flex flex-col items-center px-6 py-16 text-center">
              <Newspaper className="h-7 w-7 text-slate-500" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Новостей пока нет</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Как только администрация опубликует первую новость, она появится здесь.
              </p>
            </div>
          ) : (
            <>
              {featured && (
                <NewsFeaturedCard post={featured} badge={page === 1 ? 'Свежее' : 'Из ленты'} />
              )}

              {rest.length > 0 && (
                <>
                  <div className="mb-4 mt-9 flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-white">Ещё в ленте</h2>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {posts.length} на странице
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post) => (
                      <NewsCard key={post.id} post={post} />
                    ))}
                  </div>
                </>
              )}

              <Pagination
                page={page}
                pages={pages}
                total={total}
                onPageChange={(next) => {
                  setPage(next);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={loading}
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
