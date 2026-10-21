import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { useNews } from '../../hooks/useNews';
import { NewsCard } from './NewsCard';

/** Блок «Новости» на главной: три последние публикации. */
export function NewsBlock() {
  const { posts, total, loading } = useNews(3);

  // Пока новостей нет, блок не занимает место на главной.
  if (loading || posts.length === 0) return null;

  return (
    <section id="news" className="container-page mt-10 mb-10 scroll-mt-24">
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
      </div>
    </section>
  );
}
