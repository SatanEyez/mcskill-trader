import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  ImagePlus,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ApiError,
  createNews,
  deleteNews,
  fetchAllNews,
  updateNews,
  uploadImage,
} from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatDateTimeMsk, pluralize } from '../lib/format';
import type { NewsPost } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { NewsEditor } from '../components/admin/NewsEditor';
import { Checkbox } from '../components/ui/Checkbox';
import { sanitizeNewsHtml, stripHtml } from '../lib/news-html';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Modal } from '../components/ui/Modal';
import { PageLoader, Spinner } from '../components/ui/Spinner';

const PAGE_SIZE = 20;

interface FormState {
  title: string;
  body: string;
  image_url: string;
  is_published: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  body: '',
  image_url: '',
  is_published: true,
};

export function AdminNewsPage() {
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NewsPost | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const response = await fetchAllNews({ limit: PAGE_SIZE, offset });
        setPosts(response.data);
        setTotal(response.meta.total);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить новости');
      } finally {
        setLoading(false);
      }
    },
    [offset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (post: NewsPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      body: post.body,
      image_url: post.image_url ?? '',
      is_published: post.is_published,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormError(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Выберите изображение (PNG, JPG, WebP или GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Файл больше 5 МБ');
      return;
    }

    setUploading(true);
    setFormError(null);

    try {
      const uploaded = await uploadImage(file);
      setForm((current) => ({ ...current, image_url: uploaded.url }));
    } catch (uploadError) {
      setFormError(
        uploadError instanceof ApiError ? uploadError.message : 'Не удалось загрузить изображение',
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const body = sanitizeNewsHtml(form.body).trim();
    const bodyText = stripHtml(body).replace(/\u00a0/g, ' ').trim();

    if (title.length < 3) {
      setFormError('Заголовок слишком короткий');
      return;
    }

    if (bodyText.length < 10) {
      setFormError('Текст слишком короткий (минимум 10 символов)');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        title,
        body,
        image_url: form.image_url.trim(),
        is_published: form.is_published,
      };

      if (editingId) {
        await updateNews(editingId, payload);
        notify('Новость обновлена');
      } else {
        await createNews(payload);
        notify('Новость опубликована');
      }

      setFormOpen(false);
      await load(true);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить новость');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);

    try {
      await deleteNews(deleteTarget.id);
      notify('Новость удалена');
      setDeleteTarget(null);
      await load(true);
    } catch (deleteError) {
      notify(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить новость',
        'error',
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Контент
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white sm:text-3xl">
              <Newspaper className="h-6 w-6 text-accent" aria-hidden />
              Новости
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Публикации появляются в ленте на сайте и в блоке на главной. Черновики видны только
              здесь.
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn btn-secondary"
              disabled={loading}
            >
              <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
              Обновить
            </button>
            <button type="button" onClick={openCreate} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Новая новость
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {error}
            </span>
            <button type="button" onClick={() => void load()} className="btn btn-secondary px-3 py-1.5 text-xs">
              Повторить
            </button>
          </div>
        )}

        {loading && posts.length === 0 ? (
          <PageLoader label="Загружаем новости…" />
        ) : posts.length === 0 ? (
          <div className="panel mt-6 flex flex-col items-center px-6 py-14 text-center">
            <Newspaper className="h-7 w-7 text-slate-500" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-white">Новостей ещё нет</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Нажмите «Новая новость», чтобы опубликовать первую запись.
            </p>
            <button type="button" onClick={openCreate} className="btn btn-primary mt-5">
              <Plus className="h-4 w-4" aria-hidden />
              Новая новость
            </button>
          </div>
        ) : (
          <>
            <div className="panel mt-6 overflow-hidden">
              <ul className="divide-y divide-white/[0.04]">
                {posts.map((post) => (
                  <li key={post.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                            post.is_published
                              ? 'border-accent/25 bg-accent/[0.08] text-accent-300'
                              : 'border-white/10 bg-white/[0.03] text-slate-400',
                          )}
                        >
                          {post.is_published ? 'Опубликовано' : 'Черновик'}
                        </span>
                        {post.views > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                            <Eye className="h-3 w-3" aria-hidden />
                            {post.views}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 truncate text-sm font-semibold text-white">{post.title}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-600">
                        {post.created_by_login ?? 'неизвестный автор'} ·{' '}
                        {formatDateTimeMsk(post.published_at ?? post.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(post)}
                        className="btn btn-secondary px-3 py-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(post)}
                        className="btn btn-danger px-3 py-1.5 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Страница {currentPage} из {pages} · {total}{' '}
                  {pluralize(total, ['новость', 'новости', 'новостей'])}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0 || loading}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={currentPage >= pages || loading}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? 'Редактировать новость' : 'Новая новость'}
        description="Заголовок и текст увидят все посетители сайта."
        size="lg"
        footer={
          <>
            <button type="button" onClick={closeForm} className="btn btn-secondary" disabled={saving}>
              Отмена
            </button>
            <button type="button" onClick={() => void handleSave()} className="btn btn-primary" disabled={saving || uploading}>
              {saving ? <Spinner /> : null}
              {editingId ? 'Сохранить' : 'Опубликовать'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="news-title" className="mb-1.5 block text-xs font-medium text-slate-300">
              Заголовок
            </label>
            <input
              id="news-title"
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={160}
              placeholder="Например: обновление цен на ресурсы"
              className="field py-2.5"
            />
          </div>

          <div>
            <label htmlFor="news-body" className="mb-1.5 block text-xs font-medium text-slate-300">
              Текст
            </label>
            <NewsEditor
              id="news-body"
              value={form.body}
              onChange={(html) => setForm({ ...form, body: html })}
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Шрифт и цвет применяются к выделенному фрагменту. Разметка сохраняется вместе
              с новостью и очищается от лишних тегов при публикации.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-300">
              Изображение (необязательно)
            </span>

            {form.image_url ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
                <img src={form.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, image_url: '' })}
                  className="btn btn-ghost px-2 py-1.5 text-xs"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Убрать
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.015] px-4 py-6 text-xs text-slate-400 transition hover:border-accent/40 hover:text-slate-200"
              >
                {uploading ? <Spinner /> : <ImagePlus className="h-5 w-5" aria-hidden />}
                {uploading ? 'Загружаем…' : 'Загрузить картинку (до 5 МБ)'}
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>

          <div
            role="checkbox"
            aria-checked={form.is_published}
            tabIndex={0}
            onClick={() => setForm({ ...form, is_published: !form.is_published })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setForm({ ...form, is_published: !form.is_published });
              }
            }}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 transition hover:border-white/15"
          >
            <Checkbox
              checked={form.is_published}
              onChange={() => setForm({ ...form, is_published: !form.is_published })}
              label="Опубликовать сразу"
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-slate-300">
              Опубликовать сразу
              <span className="mt-0.5 block text-[11px] text-slate-500">
                Если снять — новость сохранится черновиком и не появится на сайте.
              </span>
            </span>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => (deleteBusy ? undefined : setDeleteTarget(null))}
        title="Удалить новость?"
        description="Запись исчезнет из ленты и с главной страницы. Действие попадёт в журнал."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="btn btn-secondary"
              disabled={deleteBusy}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="btn btn-danger"
              disabled={deleteBusy}
            >
              {deleteBusy ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {deleteBusy ? 'Удаляем…' : 'Удалить'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-300">
            «{deleteTarget.title}» будет удалена без возможности восстановления.
          </p>
        )}
      </Modal>
    </div>
  );
}
