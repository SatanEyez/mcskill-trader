import { Link } from 'react-router-dom';
import { ArrowRight, Eye, Newspaper } from 'lucide-react';
import type { NewsPost } from '../../types';
import { formatDateMsk } from '../../lib/format';
import { stripHtml } from '../../lib/news-html';

/** Короткий анонс: первая пара предложений без переносов строк и разметки. */
export function newsExcerpt(body: string, length = 220): string {
  const flat = stripHtml(body).replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  return `${flat.slice(0, length).trimEnd()}…`;
}

/** «1 мин чтения» — по 180 слов в минуту, минимум одна минута. */
export function newsReadingTime(body: string): string {
  const words = stripHtml(body).trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 180))} мин чтения`;
}

function NewsCover({ post, className = '' }: { post: NewsPost; className?: string }) {
  if (!post.image_url) {
    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(52,211,153,0.16),transparent_62%)] ${className}`}
      >
        <Newspaper className="h-10 w-10 text-accent/35" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={post.image_url}
      alt=""
      loading="lazy"
      className={`h-full w-full object-cover transition duration-700 group-hover:scale-[1.03] ${className}`}
    />
  );
}

function NewsViews({ views, className = '' }: { views: number; className?: string }) {
  if (views <= 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Eye className="h-3 w-3" aria-hidden />
      {views}
    </span>
  );
}

interface NewsCardProps {
  post: NewsPost;
}

/** Карточка ленты: крупная обложка 16:9, дата, заголовок и анонс. */
export function NewsCard({ post }: NewsCardProps) {
  return (
    <Link
      to={`/news/${post.id}`}
      className="panel group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-white/[0.035]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <NewsCover post={post} />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/10 to-transparent opacity-80" />
        <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-void/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-accent-300 backdrop-blur">
          Новость
        </span>
        <NewsViews
          views={post.views}
          className="absolute right-3 top-3 rounded-full border border-white/10 bg-void/70 px-2 py-1 text-[10px] font-medium text-slate-300 backdrop-blur"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          <time dateTime={post.published_at ?? post.created_at}>
            {formatDateMsk(post.published_at ?? post.created_at)}
          </time>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>{newsReadingTime(post.body)}</span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-white transition group-hover:text-accent-300">
          {post.title}
        </h3>

        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-400">
          {newsExcerpt(post.body)}
        </p>

        <span className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] font-semibold text-accent-300">
          Читать
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

interface NewsFeaturedCardProps extends NewsCardProps {
  badge?: string;
}

/** Большая карточка для главной новости страницы новостей. */
export function NewsFeaturedCard({ post, badge = 'Свежее' }: NewsFeaturedCardProps) {
  return (
    <Link
      to={`/news/${post.id}`}
      className="group grid overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/70 shadow-card transition duration-300 hover:border-accent/25 hover:bg-white/[0.035] lg:grid-cols-[1.15fr_0.85fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/9] lg:aspect-auto lg:min-h-[400px]">
        <NewsCover post={post} />
        <div className="absolute inset-0 bg-gradient-to-t from-panel/85 via-panel/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-panel/5 lg:to-panel" />
        <span className="absolute left-4 top-4 rounded-full border border-accent/25 bg-void/75 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-300 backdrop-blur">
          {badge}
        </span>
        <NewsViews
          views={post.views}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-void/75 px-2.5 py-1 text-[10px] font-medium text-slate-300 backdrop-blur"
        />
      </div>

      <div className="relative flex flex-col justify-center p-6 sm:p-8 lg:p-9">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          <time dateTime={post.published_at ?? post.created_at}>
            {formatDateMsk(post.published_at ?? post.created_at)}
          </time>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>{newsReadingTime(post.body)}</span>
        </div>

        <h2 className="mt-3 text-2xl font-semibold leading-[1.15] text-white transition group-hover:text-accent-300 sm:text-3xl lg:text-[32px]">
          {post.title}
        </h2>

        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
          {newsExcerpt(post.body, 260)}
        </p>

        <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-accent-300">
          Читать новость
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** Компактная карточка для сайдбара «Читайте также». */
export function NewsMiniCard({ post }: NewsCardProps) {
  return (
    <Link
      to={`/news/${post.id}`}
      className="group flex gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
    >
      <div className="relative h-[72px] w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.06]">
        <NewsCover post={post} />
      </div>

      <div className="min-w-0 py-0.5">
        <time
          dateTime={post.published_at ?? post.created_at}
          className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500"
        >
          {formatDateMsk(post.published_at ?? post.created_at)}
        </time>
        <h3 className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-200 transition group-hover:text-accent-300">
          {post.title}
        </h3>
      </div>
    </Link>
  );
}
