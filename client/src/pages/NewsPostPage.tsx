import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Eye } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, fetchNewsPost } from '../lib/api';
import { formatDateTimeMsk } from '../lib/format';
import { looksLikeHtml, sanitizeNewsHtml } from '../lib/news-html';
import type { NewsPost } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { PageLoader } from '../components/ui/Spinner';

export function NewsPostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container-page max-w-3xl py-10 sm:py-12">
          <Link
            to="/news"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Все новости
          </Link>

          {loading ? (
            <PageLoader label="Загружаем новость…" />
          ) : error || !post ? (
            <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h1 className="mt-3 text-base font-semibold text-white">Новость недоступна</h1>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error ?? 'Новость не найдена'}</p>
              <Link to="/news" className="btn btn-primary mt-5">
                Вернуться к ленте
              </Link>
            </div>
          ) : (
            <article className="mt-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <time dateTime={post.published_at ?? post.created_at}>
                  {formatDateTimeMsk(post.published_at ?? post.created_at)}
                </time>
                {post.created_by_login && <span>· {post.created_by_login}</span>}
                {post.views > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    {post.views}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                {post.title}
              </h1>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt=""
                  className="mt-5 w-full rounded-2xl border border-white/[0.06] object-cover"
                />
              )}

              {looksLikeHtml(post.body) ? (
                <div
                  className="mt-5 text-sm leading-relaxed text-slate-300 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-3 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  // Разметку присылает только редактор новостей, перед вставкой она чистится.
                  dangerouslySetInnerHTML={{ __html: sanitizeNewsHtml(post.body) }}
                />
              ) : (
                <div className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {post.body}
                </div>
              )}
            </article>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
