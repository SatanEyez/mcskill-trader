import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  FolderOpen,
  FolderPlus,
  Layers,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, createCategory, updateCategory } from '../lib/api';
import { formatDate, pluralize } from '../lib/format';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../context/ToastContext';
import type { Category } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { DeleteCategoryDialog } from '../components/admin/DeleteCategoryDialog';
import { PageLoader } from '../components/ui/Spinner';

const NAME_MIN = 2;
const NAME_MAX = 60;

function validateName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < NAME_MIN) return 'Минимум 2 символа';
  if (trimmed.length > NAME_MAX) return 'Слишком длинное название';
  return null;
}

export function AdminCategoriesPage() {
  const { categories, loading, error, reload } = useCategories();
  const { notify } = useToast();

  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Категории — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const stats = useMemo(() => {
    const withResources = categories.filter((category) => category.resource_count > 0);
    const assigned = categories.reduce((sum, category) => sum + category.resource_count, 0);

    return {
      total: categories.length,
      withResources: withResources.length,
      empty: categories.length - withResources.length,
      assigned,
    };
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, query]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;

    const validationError = validateName(newName);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const category = await createCategory(newName.trim());
      setNewName('');
      notify(`Категория «${category.name}» создана`, 'success');
      void reload({ silent: true });
    } catch (createFailure) {
      setCreateError(
        createFailure instanceof ApiError
          ? createFailure.message
          : 'Не удалось создать категорию. Попробуйте ещё раз.',
      );
    } finally {
      setCreating(false);
    }
  };

  const startRename = (category: Category) => {
    setEditingId(category.id);
    setDraftName(category.name);
  };

  const cancelRename = () => {
    if (savingId) return;
    setEditingId(null);
    setDraftName('');
  };

  const saveRename = async (category: Category) => {
    if (savingId) return;

    const validationError = validateName(draftName);
    if (validationError) {
      notify(validationError, 'error');
      return;
    }

    if (draftName.trim() === category.name) {
      cancelRename();
      return;
    }

    setSavingId(category.id);

    try {
      const updated = await updateCategory(category.id, draftName.trim());
      setEditingId(null);
      setDraftName('');
      notify(`Категория переименована в «${updated.name}»`, 'success');
      void reload({ silent: true });
    } catch (renameFailure) {
      notify(
        renameFailure instanceof ApiError
          ? renameFailure.message
          : 'Не удалось переименовать категорию',
        'error',
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleted = (category: Category, movedResources: number) => {
    setDeletingCategory(null);
    const resourcesLabel = pluralize(movedResources, ['ресурс', 'ресурса', 'ресурсов']);
    const verb = movedResources === 1 ? 'перешёл' : 'перешли';

    notify(
      movedResources > 0
        ? `Категория «${category.name}» удалена, ${movedResources} ${resourcesLabel} ${verb} в «Без категории»`
        : `Категория «${category.name}» удалена`,
      'success',
    );
    void reload({ silent: true });
  };

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Управление каталогом
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Категории</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Создавайте группы предметов и переименовывайте их. При удалении категории ресурсы
              остаются в каталоге и переходят в «Без категории».
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Всего категорий
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/20 bg-accent/[0.08] text-accent">
                <Tags className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : stats.total}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">групп предметов</p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                С ресурсами
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
                <FolderOpen className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : stats.withResources}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {loading ? '—' : `${stats.assigned} ресурсов распределено`}
            </p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Пустые
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : stats.empty}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">можно удалить без потерь</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="panel mt-6 p-4" noValidate>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="new-category" className="field-label">
                Новая категория
              </label>
              <div className="relative">
                <FolderPlus
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  id="new-category"
                  value={newName}
                  onChange={(event) => {
                    setNewName(event.target.value);
                    if (createError) setCreateError(null);
                  }}
                  placeholder="Например, Инструменты"
                  maxLength={NAME_MAX + 10}
                  className={clsx('field pl-10', createError && 'border-rose-500/60')}
                  aria-invalid={Boolean(createError)}
                  aria-describedby={createError ? 'new-category-error' : undefined}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary shrink-0" disabled={creating}>
              <Plus className="h-4 w-4" aria-hidden />
              {creating ? 'Создаём…' : 'Добавить категорию'}
            </button>
          </div>
          {createError && (
            <p id="new-category-error" role="alert" className="mt-2 text-[11px] text-rose-300">
              {createError}
            </p>
          )}
        </form>

        <div className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти категорию…"
                className="field py-2.5 pl-10 text-sm [&::-webkit-search-cancel-button]:hidden"
                aria-label="Поиск категории"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>
                Показано {filteredCategories.length} из {categories.length}
              </span>
              <button
                type="button"
                onClick={() => void reload({ silent: true })}
                className="icon-btn h-8 w-8"
                title="Обновить список"
                aria-label="Обновить список категорий"
                disabled={loading}
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
              </button>
            </div>
          </div>

          {error && categories.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void reload()}
                className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Повторить
              </button>
            </div>
          )}

          {error && !loading && categories.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить категории</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : loading && categories.length === 0 ? (
            <PageLoader label="Загружаем категории…" />
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <PackageSearch className="h-6 w-6 text-slate-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">
                {query.trim() ? 'Категория не найдена' : 'Категорий пока нет'}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                {query.trim()
                  ? 'Попробуйте другой запрос.'
                  : 'Создайте первую категорию — после этого её можно выбрать в форме ресурса.'}
              </p>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="btn btn-secondary mt-5"
                >
                  Сбросить поиск
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {filteredCategories.map((category) => {
                const isEditing = editingId === category.id;
                const isSaving = savingId === category.id;

                return (
                  <li
                    key={category.id}
                    className="flex flex-col gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-400">
                        <FolderOpen className="h-4 w-4" aria-hidden />
                      </span>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void saveRename(category);
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              value={draftName}
                              onChange={(event) => setDraftName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                              maxLength={NAME_MAX + 10}
                              className="field max-w-xs py-1.5 text-sm"
                              aria-label={`Новое название категории ${category.name}`}
                            />
                            <button
                              type="submit"
                              className="icon-btn h-8 w-8 hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                              disabled={isSaving}
                              aria-label="Сохранить название"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              className="icon-btn h-8 w-8"
                              disabled={isSaving}
                              aria-label="Отменить переименование"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </form>
                        ) : (
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {category.name}
                          </p>
                        )}

                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
                          <span>
                            {category.resource_count}{' '}
                            {pluralize(category.resource_count, ['ресурс', 'ресурса', 'ресурсов'])}
                          </span>
                          <span aria-hidden>·</span>
                          <span>обновлена {formatDate(category.updated_at)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                      <span
                        className={clsx(
                          'rounded-full border px-2.5 py-1 text-[10px] font-medium',
                          category.resource_count > 0
                            ? 'border-accent/25 bg-accent/[0.08] text-accent-300'
                            : 'border-white/[0.07] bg-white/[0.03] text-slate-500',
                        )}
                      >
                        {category.resource_count > 0
                          ? `${category.resource_count} в каталоге`
                          : 'пустая'}
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => startRename(category)}
                          className="icon-btn h-8 w-8"
                          title={`Переименовать «${category.name}»`}
                          aria-label={`Переименовать ${category.name}`}
                          disabled={isEditing}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(category)}
                          className="icon-btn h-8 w-8 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                          title={`Удалить «${category.name}»`}
                          aria-label={`Удалить ${category.name}`}
                          disabled={isEditing}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          Категории используются в фильтрах каталога и в форме редактирования ресурса. Названия
          уникальны без учёта регистра.
        </p>
      </main>

      <DeleteCategoryDialog
        category={deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
