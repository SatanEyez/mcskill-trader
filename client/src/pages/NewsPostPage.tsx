import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Eye,
  Newspaper,
  UserRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, fetchNewsPost } from '../lib/api';
import { formatDateTimeMsk } from '../lib/format';
import { looksLikeHtml, sanitizeNewsHtml, stripHtml } from '../lib/news-html';
import type { NewsPost } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { NewsMiniCard, newsReadingTime } from '../components/news/NewsCard';
import { PageLoader } from '../components/ui/Spinner';
import { useNews } from '../hooks/useNews';

export function NewsPostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { posts: latest } = useNews(4);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError('Новость не найдена');
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await fetchNewsPost(id);
        if (cancelled) return;
        setPost(data);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;

        if (loadError instanceof ApiError && loadError.status === 404) {
          setError('Новость не найдена или ещё не опубликована');
        } else {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить новость');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!post) return;

    const previousTitle = document.title;
    document.title = `${post.title} — McSkill Trader`;

    return () => {
      document.title = previousTitle;
    };
  }, [post]);

  const bodyText = post ? stripHtml(post.body).replace(/\s+/g, ' ').trim() : '';
  const shortBody = bodyText.length > 0 && bodyText.length < 220;
  const related = latest.filter((item) => item.id !== post?.id).slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {loading ? (
          <div className="container-page py-14">
            <PageLoader label="Загружаем новость…" />
          </div>
        ) : error || !post ? (
          <div className="container-page py-10 sm:py-14">
            <div className="panel mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h1 className="mt-3 text-base font-semibold text-white">Новость недоступна</h1>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error ?? 'Новость не найдена'}</p>
              <Link to="/news" className="btn btn-primary mt-5">
                Вернуться к ленте
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden border-b border-white/[0.05]">
              {post.image_url && (
                <div
                  className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-3xl"
                  style={{ backgroundImage: `url(${post.image_url})` }}
                  aria-hidden
                />
              )}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/40 via-void/75 to-void"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 bg-hero-glow" aria-hidden />

              <div className="container-page relative py-8 sm:py-12">
                <Link
                  to="/news"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-accent-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Все новости
                </Link>

                <div className="mt-7 max-w-5xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-300">
                      Новость
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      <time dateTime={post.published_at ?? post.created_at}>
                        {formatDateTimeMsk(post.published_at ?? post.created_at)}
                      </time>
                    </span>
                    {post.created_by_login && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
                        <UserRound className="h-3 w-3" aria-hidden />
                        {post.created_by_login}
                      </span>
                    )}
                    {post.views > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
                        <Eye className="h-3 w-3" aria-hidden />
                        {post.views}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
                      <Clock3 className="h-3 w-3" aria-hidden />
                      {newsReadingTime(post.body)}
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold leading-[1.08] text-white sm:text-4xl lg:text-[52px]">
                    {post.title}
                  </h1>
                </div>
              </div>
            </section>

            {post.image_url && (
              <div className="container-page mt-6 sm:mt-8">
                <figure className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-1.5 shadow-card sm:p-2">
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full rounded-[18px] object-cover sm:rounded-[20px]"
                  />
                </figure>
              </div>
            )}

            <div className="container-page py-8 sm:py-10">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
                <article>
                  <div className="panel p-5 sm:p-8 lg:p-10">
                    <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-300">
                      <span className="h-px w-6 bg-accent/50" aria-hidden />
                      {shortBody ? 'Коротко' : 'Текст новости'}
                    </div>

                    {shortBody ? (
                      <p className="max-w-3xl text-xl font-medium leading-relaxed text-slate-100 sm:text-2xl sm:leading-relaxed">
                        {bodyText}
                      </p>
                    ) : looksLikeHtml(post.body) ? (
                      <div
                        className="news-prose"
                        // Разметку присылает только редактор новостей, перед вставкой она чистится.
                        dangerouslySetInnerHTML={{ __html: sanitizeNewsHtml(post.body) }}
                      />
                    ) : (
                      <div className="news-prose whitespace-pre-line">{post.body}</div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link to="/news" className="btn btn-secondary">
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Все новости
                    </Link>
                    <Link to="/exchange" className="btn btn-primary">
                      Открыть обменник
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </article>

                <aside className="space-y-5 lg:sticky lg:top-24">
                  {related.length > 0 && (
                    <section className="panel p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Newspaper className="h-4 w-4 text-accent" aria-hidden />
                          Читайте также
                        </h2>
                        <Link
                          to="/news"
                          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:text-accent-300"
                        >
                          Все
                        </Link>
                      </div>

                      <div className="mt-3 space-y-1">
                        {related.map((item) => (
                          <NewsMiniCard key={item.id} post={item} />
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="relative overflow-hidden rounded-2xl border border-accent/20 bg-accent/[0.06] p-5">
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl"
                      aria-hidden
                    />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-300">
                      Обменник
                    </p>
                    <h2 className="mt-2 text-lg font-semibold leading-snug text-white">
                      10 вариантов за один предмет
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      Подбери, что получить за свой варп: один предмет, количество от 1 до 64.
                    </p>
                    <Link
                      to="/exchange"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-300 transition hover:text-accent-300"
                    >
                      Подобрать обмен
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </section>
                </aside>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
