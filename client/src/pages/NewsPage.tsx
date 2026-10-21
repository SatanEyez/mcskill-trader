import { useEffect, useState } from 'react';
import { AlertTriangle, Newspaper, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { NewsCard } from '../components/news/NewsCard';
import { Pagination } from '../components/ui/Pagination';
import { PageLoader } from '../components/ui/Spinner';
import { useNews } from '../hooks/useNews';

const PAGE_SIZE = 9;

export function NewsPage() {
  const [page, setPage] = useState(1);
  const { posts, total, loading, error, reload } = useNews(PAGE_SIZE, (page - 1) * PAGE_SIZE);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <div className="container-page py-10 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Лента
          </p>
          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold text-white sm:text-3xl">
            <Newspaper className="h-6 w-6 text-accent" aria-hidden />
            Новости
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Изменения цен, обновления каталога и объявления администрации сервера McSkill OneBlock.
          </p>

          {error && posts.length > 0 && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {error}
              </span>
              <button type="button" onClick={() => void reload()} className="btn btn-secondary px-3 py-1.5 text-xs">
                Повторить
              </button>
            </div>
          )}

          {loading && posts.length === 0 ? (
            <PageLoader label="Загружаем новости…" />
          ) : error && posts.length === 0 ? (
            <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить новости</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
              <Newspaper className="h-7 w-7 text-slate-500" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Новостей пока нет</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Как только администрация опубликует первую новость, она появится здесь.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <NewsCard key={post.id} post={post} />
                ))}
              </div>

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
