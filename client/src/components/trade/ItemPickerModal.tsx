import { useEffect, useMemo, useState } from 'react';
import { Check, PackageSearch, Plus, Search, Store } from 'lucide-react';
import clsx from 'clsx';
import type { Resource } from '../../types';
import { UNCATEGORIZED_LABEL } from '../../lib/constants';
import { readableNameColor } from '../../lib/color';
import { formatPrice, fuzzyMatch } from '../../lib/format';
import { MAX_TRADE_LINES } from '../../lib/trade';
import { Modal } from '../ui/Modal';
import { ItemImage } from '../ui/ItemImage';

interface ItemPickerModalProps {
  open: boolean;
  sideTitle: string;
  resources: Resource[];
  selectedIds: string[];
  onPick: (resource: Resource) => void;
  onClose: () => void;
}

export function ItemPickerModal({
  open,
  sideTitle,
  resources,
  selectedIds,
  onPick,
  onClose,
}: ItemPickerModalProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategoryId('all');
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atLimit = selectedIds.length >= MAX_TRADE_LINES;

  const categories = useMemo(() => {
    const map = new Map<string, string>();

    for (const resource of resources) {
      const key = resource.category_id ?? 'none';
      if (!map.has(key)) map.set(key, resource.category);
    }

    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru'),
    );
  }, [resources]);

  const filtered = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch = !query.trim() || fuzzyMatch(query, resource.name);
      const matchesCategory =
        categoryId === 'all' ||
        (categoryId === 'none' ? resource.category_id === null : resource.category_id === categoryId);

      return matchesSearch && matchesCategory;
    });
  }, [resources, query, categoryId]);

  // 9 000+ <li> в модалке подвешивают браузер. Показываем первые 80,
  // а уточнить выбор предлагаем поиском/категорией.
  const visible = useMemo(() => filtered.slice(0, 80), [filtered]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить предмет"
      description={`Сторона «${sideTitle}». Повторный выбор увеличит количество.`}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-[11px] text-slate-500">
            Выбрано {selectedIds.length} из {MAX_TRADE_LINES}
            {atLimit && ' · достигнут лимит'}
          </span>
          <button type="button" onClick={onClose} className="btn btn-primary">
            Готово
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти предмет — алмаз, элитры, звезда…"
            className="field py-2.5 pl-10 [&::-webkit-search-cancel-button]:hidden"
            aria-label="Поиск предмета"
          />
        </div>

        <div
          className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Фильтр по категориям"
        >
          <CategoryChip
            label="Все"
            active={categoryId === 'all'}
            onClick={() => setCategoryId('all')}
          />

          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            />
          ))}

          {categories.some((category) => category.id === 'none') && (
            <CategoryChip
              label={UNCATEGORIZED_LABEL}
              active={categoryId === 'none'}
              onClick={() => setCategoryId('none')}
            />
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-white/[0.08] px-6 py-12 text-center">
            <PackageSearch className="h-6 w-6 text-slate-500" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-300">Ничего не найдено</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Попробуйте изменить запрос или выбрать другую категорию.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((resource) => {
              const inSide = selectedSet.has(resource.id);
              const disabled = !inSide && atLimit;

              return (
                <li key={resource.id}>
                  <button
                    type="button"
                    onClick={() => onPick(resource)}
                    disabled={disabled}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition',
                      inSide
                        ? 'border-accent/25 bg-accent/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]',
                      disabled && 'cursor-not-allowed opacity-40 hover:border-white/[0.06] hover:bg-white/[0.02]',
                    )}
                    title={
                      disabled
                        ? `Лимит ${MAX_TRADE_LINES} предметов на сторону`
                        : inSide
                          ? 'Увеличить количество на 1'
                          : 'Добавить предмет'
                    }
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                      <ItemImage src={resource.image_url} alt="" className="h-full w-full" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium text-slate-100"
                        style={{ color: readableNameColor(resource.name_color) }}
                      >
                        {resource.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {resource.category}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block text-[11px] font-semibold text-accent-300">
                        {formatPrice(resource.min_price)}
                      </span>
                      <span className="block text-[9px] uppercase tracking-wide text-slate-600">
                        монет
                      </span>
                    </span>

                    <span
                      className={clsx(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-lg border',
                        inSide
                          ? 'border-accent/30 bg-accent/10 text-accent'
                          : 'border-white/[0.08] bg-white/[0.03] text-slate-400',
                      )}
                      aria-hidden
                    >
                      {inSide ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > visible.length && (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500">
            Показаны первые {visible.length} из {filtered.length}. Уточните запрос или выберите
            категорию, чтобы найти нужный предмет.
          </p>
        )}

        <p className="flex items-center gap-2 text-[10px] leading-relaxed text-slate-600">
          <Store className="h-3 w-3 shrink-0" aria-hidden />
          Цены берутся из каталога: минимальная цена за 1 предмет.
        </p>
      </div>
    </Modal>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function CategoryChip({ label, active, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'chip',
        active
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200',
      )}
    >
      {label}
    </button>
  );
}
