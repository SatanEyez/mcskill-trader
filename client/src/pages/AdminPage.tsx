import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useResourceFeed } from '../hooks/useResourceFeed';
import { useResourceStats } from '../hooks/useResourceStats';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ExcludedResource, Resource } from '../types';
import { formatDate, formatDateTimeMsk, formatPrice } from '../lib/format';
import {
  ApiError,
  deleteResources,
  fetchExcludedResources,
  restoreExcludedResource,
} from '../lib/api';
import { readableNameColor } from '../lib/color';
import { categoryStyle } from '../lib/constants';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { AdminStats } from '../components/admin/AdminStats';
import { ResourceFormModal } from '../components/admin/ResourceFormModal';
import { DeleteResourceDialog } from '../components/admin/DeleteResourceDialog';
import { ItemImage } from '../components/ui/ItemImage';
import { Modal } from '../components/ui/Modal';
import { PageLoader, Spinner } from '../components/ui/Spinner';
import { Pagination } from '../components/ui/Pagination';

const PAGE_SIZE = 40;

/** Категории для бейджей: все, а у старых ответов — хотя бы основная. */
function categoriesOf(resource: Resource) {
  return resource.categories?.length
    ? resource.categories
    : [{ id: resource.category_id ?? 'none', name: resource.category }];
}

export function AdminPage() {
  const { categories, reload: reloadCategories } = useCategories();
  const { stats, loading: statsLoading, reload: reloadStats } = useResourceStats();
  const { notify } = useToast();
  const { can } = useAuth();
  const canManageDeleted = can('resources.delete');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [excluded, setExcluded] = useState<ExcludedResource[]>([]);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [excludedLoading, setExcludedLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { resources, total, pages, loading, error, reload } = useResourceFeed({
    search,
    categoryId: categoryId === 'all' ? '' : categoryId,
    sort: 'name_asc',
    page,
    limit: PAGE_SIZE,
  });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Админ-панель — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const hasFilters = searchInput.trim() !== '' || categoryId !== 'all';

  const loadExcluded = useCallback(
    async (silent = false) => {
      if (!canManageDeleted) return;

      if (!silent) setExcludedLoading(true);

      try {
        setExcluded(await fetchExcludedResources());
      } catch (loadError) {
        if (!silent) {
          notify(
            loadError instanceof ApiError
              ? loadError.message
              : 'Не удалось загрузить удалённые предметы',
            'error',
          );
        }
      } finally {
        if (!silent) setExcludedLoading(false);
      }
    },
    [canManageDeleted, notify],
  );

  useEffect(() => {
    void loadExcluded(true);
  }, [loadExcluded]);

  // Смена фильтра или страницы сбрасывает выделение — иначе можно удалить
  // предметы, которых уже не видно в списке.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, categoryId, page]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const allVisibleSelected =
    resources.length > 0 && resources.every((item) => selectedIds.has(item.id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const everySelected = resources.every((item) => current.has(item.id));

      return everySelected ? new Set() : new Set(resources.map((item) => item.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return;

    setBulkDeleting(true);

    try {
      const result = await deleteResources([...selectedIds]);
      notify(
        result.count === 1 ? 'Предмет удалён из каталога' : `Удалено предметов: ${result.count}`,
        'success',
      );
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      void reload({ silent: true });
      void reloadStats();
      void reloadCategories({ silent: true });
      void loadExcluded(true);
    } catch (deleteError) {
      notify(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Не удалось удалить выбранные предметы',
        'error',
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setEditingResource(null);
    setFormOpen(true);
  };

  const openEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormOpen(true);
  };

  const handleSaved = (message: string) => {
    setFormOpen(false);
    setEditingResource(null);
    notify(message, 'success');
    void reload({ silent: true });
    void reloadStats();
    void reloadCategories({ silent: true });
  };

  const handleDeleted = (resource: Resource) => {
    setDeletingResource(null);
    notify(`«${resource.name}» удалён из каталога`, 'success');
    void reload({ silent: true });
    void reloadStats();
    void reloadCategories({ silent: true });
    void loadExcluded(true);
  };

  const handleRestore = async (item: ExcludedResource) => {
    if (restoringId) return;

    setRestoringId(item.id);

    try {
      await restoreExcludedResource(item.id);
      notify(`«${item.name}» возвращён в каталог`, 'success');
      void reload({ silent: true });
      void reloadStats();
      void reloadCategories({ silent: true });
      await loadExcluded(true);
    } catch (restoreError) {
      notify(
        restoreError instanceof ApiError
          ? restoreError.message
          : 'Не удалось вернуть предмет в каталог',
        'error',
      );
    } finally {
      setRestoringId(null);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategoryId('all');
    setPage(1);
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
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Ресурсы и минималки
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Добавляйте предметы, обновляйте цены и изображения. Изменения сразу появляются
              на главной странице.
            </p>
          </div>

          <button type="button" onClick={openCreate} className="btn btn-primary shrink-0">
            <Plus className="h-4 w-4" aria-hidden />
            Добавить ресурс
          </button>
        </div>

        <div className="mt-7">
          <AdminStats stats={stats} loading={statsLoading} />
        </div>

        {error && resources.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
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

        {error && !loading && resources.length === 0 ? (
          <div className="panel mt-6 flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.08]">
              <AlertTriangle className="h-6 w-6 text-rose-300" aria-hidden />
            </span>
            <h2 className="mt-4 text-base font-semibold text-white">Не удалось загрузить данные</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Попробовать снова
            </button>
          </div>
        ) : loading && resources.length === 0 ? (
          <PageLoader label="Загружаем ресурсы…" />
        ) : (
          <>
            <div className="panel mt-6 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Поиск по названию…"
                    className="field py-2.5 pl-10 [&::-webkit-search-cancel-button]:hidden"
                    aria-label="Поиск ресурса в админке"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setPage(1);
                    }}
                    className="field flex-1 py-2.5 text-sm sm:w-56 sm:flex-none"
                    aria-label="Фильтр по категории"
                  >
                    <option value="all">Все категории</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.resource_count})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => void reload({ silent: true })}
                    className="icon-btn h-10 w-10 shrink-0"
                    title="Обновить список"
                    aria-label="Обновить список"
                    disabled={loading}
                  >
                    <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  Показано {resources.length} из {total}
                </span>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-accent transition hover:text-accent-300"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2">
                  <span className="text-[11px] font-medium text-rose-200">
                    Выбрано: {selectedIds.size}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="btn btn-secondary px-2.5 py-1.5 text-[11px]"
                    >
                      <X className="h-3 w-3" aria-hidden />
                      Снять
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkDeleteOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      Удалить выбранные
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="panel mt-4 overflow-hidden">
              {resources.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                    <PackageSearch className="h-6 w-6 text-slate-500" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-base font-semibold text-white">
                    {hasFilters ? 'Ничего не найдено' : 'В каталоге пока пусто'}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    {hasFilters
                      ? 'Попробуйте другой запрос или категорию.'
                      : 'Добавьте первый ресурс — он появится в калькуляторе и каталоге.'}
                  </p>
                  {hasFilters ? (
                    <button type="button" onClick={resetFilters} className="btn btn-secondary mt-5">
                      Сбросить фильтры
                    </button>
                  ) : (
                    <button type="button" onClick={openCreate} className="btn btn-primary mt-5">
                      <Plus className="h-4 w-4" aria-hidden />
                      Добавить ресурс
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Таблица для планшета и десктопа */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          <th scope="col" className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleAllVisible}
                              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-emerald-400"
                              aria-label="Выбрать все предметы на странице"
                            />
                          </th>
                          <th scope="col" className="px-4 py-3 font-semibold">
                            Ресурс
                          </th>
                          <th scope="col" className="px-4 py-3 font-semibold">
                            Категория
                          </th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">
                            Мин. цена
                          </th>
                          <th scope="col" className="px-4 py-3 font-semibold">
                            Обновлён
                          </th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {resources.map((resource) => (
                          <tr
                            key={resource.id}
                            className={clsx(
                              'group transition hover:bg-white/[0.02]',
                              selectedIds.has(resource.id) && 'bg-rose-500/[0.04]',
                            )}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(resource.id)}
                                onChange={() => toggleSelected(resource.id)}
                                className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-emerald-400"
                                aria-label={`Выбрать ${resource.name}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                                  <ItemImage
                                    src={resource.image_url}
                                    alt={resource.name}
                                    className="h-full w-full"
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p
                                    className="max-w-[280px] truncate font-medium text-slate-100"
                                    style={{ color: readableNameColor(resource.name_color) }}
                                  >
                                    {resource.name}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[9px] text-slate-600">
                                    #{resource.id.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {categoriesOf(resource).map((category) => (
                                  <span
                                    key={category.id}
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${categoryStyle(category.name)}`}
                                  >
                                    {category.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-display text-sm font-semibold text-accent-300">
                                {formatPrice(resource.min_price)}
                              </span>
                              <span className="ml-1 text-[10px] text-slate-600">монет</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {formatDate(resource.updated_at)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(resource)}
                                  className="icon-btn"
                                  title={`Редактировать «${resource.name}»`}
                                  aria-label={`Редактировать ${resource.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingResource(resource)}
                                  className="icon-btn hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                                  title={`Удалить «${resource.name}»`}
                                  aria-label={`Удалить ${resource.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Карточки для телефона */}
                  <div className="divide-y divide-white/[0.05] md:hidden">
                    {resources.map((resource) => (
                      <div
                        key={resource.id}
                        className={clsx(
                          'flex items-start gap-3 p-4',
                          selectedIds.has(resource.id) && 'bg-rose-500/[0.04]',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(resource.id)}
                          onChange={() => toggleSelected(resource.id)}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 accent-emerald-400"
                          aria-label={`Выбрать ${resource.name}`}
                        />
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                          <ItemImage
                            src={resource.image_url}
                            alt={resource.name}
                            className="h-full w-full"
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold text-slate-100"
                            style={{ color: readableNameColor(resource.name_color) }}
                          >
                            {resource.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {categoriesOf(resource).map((category) => (
                              <span
                                key={category.id}
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-medium ${categoryStyle(category.name)}`}
                              >
                                {category.name}
                              </span>
                            ))}
                            <span className="text-[11px] font-semibold text-accent-300">
                              {formatPrice(resource.min_price)} монет
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-600">
                            обновлён {formatDate(resource.updated_at)}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(resource)}
                            className="icon-btn h-8 w-8"
                            aria-label={`Редактировать ${resource.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingResource(resource)}
                            className="icon-btn h-8 w-8 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                            aria-label={`Удалить ${resource.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Pagination
              page={page}
              pages={pages}
              total={total}
              onPageChange={setPage}
              disabled={loading}
            />

            <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
              Совет: загружайте иконки 16×16 или 32×32 px с прозрачным фоном — они выглядят
              чётче всего. Внешние ссылки на изображения тоже поддерживаются.
            </p>
          </>
        )}

        {canManageDeleted && (
          <section className="panel mt-5 overflow-hidden">
            <button
              type="button"
              onClick={() => setExcludedOpen((open) => !open)}
              aria-expanded={excludedOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                <Trash2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="truncate">Удалённые предметы</span>
                <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {excluded.length}
                </span>
              </span>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                  excludedOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            {excludedOpen && (
              <div className="border-t border-white/[0.05] px-4 py-3">
                {excludedLoading ? (
                  <p className="flex items-center gap-2 py-3 text-xs text-slate-500">
                    <Spinner className="h-4 w-4" />
                    Загружаем список…
                  </p>
                ) : excluded.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">
                    Пока ничего не удаляли. Удалённый предмет попадёт сюда и не вернётся при
                    следующем импорте прайса.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-white/[0.05]">
                      {excluded.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 py-2.5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
                            <ItemImage src={item.image_url} alt={item.name} className="h-full w-full" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm font-medium text-white"
                              style={{ color: readableNameColor(item.name_color) }}
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                              {item.category} · {formatPrice(item.min_price)} монет
                              {item.created_by_login ? ` · удалил ${item.created_by_login}` : ''}
                              {` · ${formatDateTimeMsk(item.created_at)}`}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() => void handleRestore(item)}
                            disabled={restoringId === item.id}
                            className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
                            aria-label={`Вернуть ${item.name} в каталог`}
                          >
                            {restoringId === item.id ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Вернуть
                          </button>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
                      Пока предмет в этом списке, импорт прайса его пропускает. «Вернуть»
                      добавляет его обратно в каталог с прежней ценой и иконкой.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <ResourceFormModal
        open={formOpen}
        resource={editingResource}
        categories={categories}
        onClose={() => {
          setFormOpen(false);
          setEditingResource(null);
        }}
        onSaved={handleSaved}
      />

      <DeleteResourceDialog
        resource={deletingResource}
        onClose={() => setDeletingResource(null)}
        onDeleted={handleDeleted}
      />

      <Modal
        open={bulkDeleteOpen}
        onClose={() => {
          if (!bulkDeleting) setBulkDeleteOpen(false);
        }}
        title="Удалить выбранные предметы?"
        description="Предметы исчезнут из каталога и попадут в стоп-лист импорта."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(false)}
              className="btn btn-secondary"
              disabled={bulkDeleting}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
            >
              {bulkDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Удалить {selectedIds.size}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-400">
          Будет удалено предметов:{' '}
          <span className="font-semibold text-white">{selectedIds.size}</span>. Они перестанут
          показываться в каталоге и в трейд-калькуляторе, а импорт прайса не вернёт их обратно.
          При необходимости предметы можно вернуть в разделе «Удалённые предметы».
        </p>
      </Modal>
    </div>
  );
}
