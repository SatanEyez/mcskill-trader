import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Newspaper } from 'lucide-react';
import clsx from 'clsx';
import { useNews } from '../../hooks/useNews';
import { NewsCard } from './NewsCard';

/** Блок «Новости» на главной: последние публикации + переход в ленту. */
export function NewsBlock() {
  const { posts, total, loading } = useNews(3);

  // Пока новостей нет, блок не занимает место на главной.
  if (loading || posts.length === 0) return null;

  // Если публикаций меньше трёх, пустое место занимает карточка-переход в ленту.
  const showMoreCard = posts.length < 3;

  return (
    <section id="news" className="container-page mb-10 mt-10 scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Новости
          </p>
          <h2 className="mt-1.5 flex items-center gap-2 text-xl font-semibold text-white sm:text-2xl">
            <Newspaper className="h-5 w-5 text-accent" aria-hidden />
            Что нового на сервере
          </h2>
        </div>

        <Link
          to="/news"
          className="shrink-0 text-xs font-medium text-slate-400 transition hover:text-accent"
        >
          Все новости{total > posts.length ? ` (${total})` : ''} →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <NewsCard key={post.id} post={post} />
        ))}

        {showMoreCard && (
          <Link
            to="/news"
            className={clsx(
              'group panel relative flex flex-col justify-center overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-[#0d1620]',
              posts.length === 1 && 'lg:col-span-2',
            )}
          >
            <span
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/0 blur-2xl transition duration-300 group-hover:bg-accent/10"
              aria-hidden
            />

            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-accent">
                <Newspaper className="h-5 w-5" aria-hidden />
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                aria-hidden
              />
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-white">Все новости сервера</h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                Обновления цен, изменения каталога и объявления администрации — вся лента
                в одном месте.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                Открыть ленту
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
