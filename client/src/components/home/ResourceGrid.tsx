import { SearchX } from 'lucide-react';
import type { Resource } from '../../types';
import { ResourceCard } from './ResourceCard';

interface ResourceGridProps {
  resources: Resource[];
  loading: boolean;
  hasFilters: boolean;
  onUse: (resource: Resource) => void;
  onResetFilters: () => void;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.05] bg-panel/70 p-4">
      <div className="flex items-start justify-between">
        <div className="h-14 w-14 rounded-xl bg-white/[0.05]" />
        <div className="h-5 w-16 rounded-full bg-white/[0.04]" />
      </div>
      <div className="mt-4 h-4 w-3/4 rounded bg-white/[0.05]" />
      <div className="mt-2 h-4 w-1/2 rounded bg-white/[0.04]" />
      <div className="mt-5 h-4 w-2/5 rounded bg-white/[0.04]" />
      <div className="mt-4 flex justify-between border-t border-white/[0.04] pt-3">
        <div className="h-3 w-14 rounded bg-white/[0.03]" />
        <div className="h-3 w-20 rounded bg-white/[0.03]" />
      </div>
    </div>
  );
}

export function ResourceGrid({
  resources,
  loading,
  hasFilters,
  onUse,
  onResetFilters,
}: ResourceGridProps) {
  if (loading) {
    return (
      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:gap-4 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <SearchX className="h-6 w-6 text-slate-500" aria-hidden />
        </span>
        <h3 className="mt-4 text-base font-semibold text-white">
          {hasFilters ? 'Ничего не нашлось' : 'В каталоге пока пусто'}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {hasFilters
            ? 'Попробуйте изменить запрос или сбросить фильтры — возможно, предмет называется иначе.'
            : 'Администратор ещё не добавил ресурсы. Загляните позже.'}
        </p>
        {hasFilters && (
          <button type="button" onClick={onResetFilters} className="btn btn-secondary mt-5">
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:gap-4 2xl:grid-cols-3">
      {resources.map((resource, index) => (
        <div
          key={resource.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <ResourceCard resource={resource} onUse={onUse} />
        </div>
      ))}
    </div>
  );
}
