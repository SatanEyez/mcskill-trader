import { useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import { SORT_OPTIONS } from '../../lib/constants';
import type { ResourceSort } from '../../types';

interface SearchControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  categories: Array<{ id: string; name: string; count: number }>;
  /** Всего ресурсов в базе — для «Все» и подписи «из N». */
  total: number;
  sort: ResourceSort;
  onSortChange: (value: ResourceSort) => void;
  /** Сколько нашлось с учётом поиска и категории. */
  filteredCount: number;
  searchRef: React.RefObject<HTMLInputElement>;
}

export function SearchControls({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  total,
  sort,
  onSortChange,
  filteredCount,
  searchRef,
}: SearchControlsProps) {
  const chipsRef = useRef<HTMLDivElement>(null);
  const isAll = categoryId === 'all';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Каталог ресурсов</h2>
          <p className="mt-1 text-sm text-slate-500">
            {filteredCount === total
              ? `${total} предметов в базе`
              : `Найдено ${filteredCount} из ${total}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="resource-sort" className="sr-only">
            Сортировка
          </label>
          <div className="relative">
            <SlidersHorizontal
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <select
              id="resource-sort"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ResourceSort)}
              className="field appearance-none py-2 pl-9 pr-8 text-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Найти предмет — алмаз, элитры, звезда…"
          className="field py-3 pl-10 pr-20 text-sm [&::-webkit-search-cancel-button]:hidden"
          aria-label="Поиск по названию предмета"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd
              className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500 sm:block"
              title="Нажмите / для поиска"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      <div
        ref={chipsRef}
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Фильтр по категориям"
      >
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={clsx(
            'chip',
            isAll
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200',
          )}
          aria-pressed={isAll}
        >
          Все
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[10px]',
              isAll ? 'bg-accent/15 text-accent' : 'bg-white/[0.05] text-slate-500',
            )}
          >
            {total}
          </span>
        </button>

        {categories.map((item) => {
          const active = categoryId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCategoryChange(item.id)}
              className={clsx(
                'chip',
                active
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200',
              )}
              aria-pressed={active}
              title={item.name}
            >
              <span className="max-w-[11rem] truncate">{item.name}</span>
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  active ? 'bg-accent/15 text-accent' : 'bg-white/[0.05] text-slate-500',
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
