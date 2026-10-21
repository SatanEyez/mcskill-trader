import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import type { NewsPost } from '../../types';
import { formatDateMsk } from '../../lib/format';
import { stripHtml } from '../../lib/news-html';

/** Короткий анонс: первая пара предложений без переносов строк и разметки. */
export function newsExcerpt(body: string, length = 220): string {
  const flat = stripHtml(body).replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  return `${flat.slice(0, length).trimEnd()}…`;
}

interface NewsCardProps {
  post: NewsPost;
}

export function NewsCard({ post }: NewsCardProps) {
  return (
    <Link
      to={`/news/${post.id}`}
      className="panel group flex flex-col overflow-hidden transition hover:border-accent/25 hover:bg-white/[0.03]"
    >
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="h-36 w-full object-cover"
        />
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
          <time dateTime={post.published_at ?? post.created_at}>
            {formatDateMsk(post.published_at ?? post.created_at)}
          </time>
          {post.views > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Eye className="h-3 w-3" aria-hidden />
              {post.views}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-white transition group-hover:text-accent-200">
          {post.title}
        </h3>

        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400">
          {newsExcerpt(post.body)}
        </p>

        <span className="mt-3 text-[11px] font-medium text-accent opacity-0 transition group-hover:opacity-100">
          Читать →
        </span>
      </div>
    </Link>
  );
}
