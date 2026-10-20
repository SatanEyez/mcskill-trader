import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Компактная пагинация каталога: первая/последняя страница и соседние номера. */
export function Pagination({ page, pages, total, onPageChange, disabled = false }: PaginationProps) {
  if (pages <= 1) return null;

  const numbers = new Set<number>([1, pages, page - 1, page, page + 1]);
  const visible = Array.from(numbers)
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);

  return (
    <nav
      className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label="Страницы каталога"
    >
      <p className="text-xs text-slate-500">
        Страница <span className="text-slate-300">{page}</span> из {pages} · всего {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn-ghost h-9 px-2"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {visible.map((value, index) => {
          const previous = visible[index - 1];
          const gap = previous !== undefined && value - previous > 1;

          return (
            <span key={value} className="flex items-center gap-1.5">
              {gap ? <span className="px-1 text-slate-600">…</span> : null}
              <button
                type="button"
                className={clsx(
                  'h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition',
                  value === page
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : 'border-slate-700/50 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                )}
                onClick={() => onPageChange(value)}
                disabled={disabled}
                aria-current={value === page ? 'page' : undefined}
              >
                {value}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          className="btn-ghost h-9 px-2"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= pages}
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
