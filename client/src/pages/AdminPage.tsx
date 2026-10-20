import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { useResourceFeed } from '../hooks/useResourceFeed';
import { useResourceStats } from '../hooks/useResourceStats';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../context/ToastContext';
import type { Resource } from '../types';
import { formatDate, formatPrice } from '../lib/format';
import { readableNameColor } from '../lib/color';
import { categoryStyle } from '../lib/constants';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { AdminStats } from '../components/admin/AdminStats';
import { ResourceFormModal } from '../components/admin/ResourceFormModal';
import { DeleteResourceDialog } from '../components/admin/DeleteResourceDialog';
import { ItemImage } from '../components/ui/ItemImage';
import { PageLoader } from '../components/ui/Spinner';
import { Pagination } from '../components/ui/Pagination';

const PAGE_SIZE = 40;

export function AdminPage() {
  const { categories, reload: reloadCategories } = useCategories();
  const { stats, loading: statsLoading, reload: reloadStats } = useResourceStats();
  const { notify } = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);

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
                          <tr key={resource.id} className="group transition hover:bg-white/[0.02]">
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
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${categoryStyle(resource.category)}`}
                              >
                                {resource.category}
                              </span>
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
                      <div key={resource.id} className="flex items-start gap-3 p-4">
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
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-medium ${categoryStyle(resource.category)}`}
                            >
                              {resource.category}
                            </span>
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
    </div>
  );
}
