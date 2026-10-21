import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ImagePlus, Link2, Plus, Save, Tag, Tags, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ApiError, createResource, updateResource, uploadImage } from '../../lib/api';
import { readableNameColor } from '../../lib/color';
import type { Category, Resource } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { ItemImage } from '../ui/ItemImage';

interface ResourceFormModalProps {
  open: boolean;
  resource: Resource | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  name: string;
  nameColor: string;
  price: string;
  /** Все категории предмета: первая — основная, дальше дополнительные. */
  categoryIds: string[];
  imageUrl: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  nameColor: '',
  price: '',
  categoryIds: [],
  imageUrl: '',
};

/** Основная категория + до четырёх дополнительных. */
const MAX_CATEGORIES = 5;

const NAME_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function formatBytes(size: number): string {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(size / 1024))} КБ`;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = 'Минимум 2 символа';
  } else if (form.name.trim().length > 120) {
    errors.name = 'Слишком длинное название';
  }

  const nameColor = form.nameColor.trim();

  if (nameColor && !NAME_COLOR_PATTERN.test(nameColor)) {
    errors.nameColor = 'Нужен формат #RRGGBB, например #55FFFF';
  }

  const price = Number(form.price.replace(',', '.'));

  if (!form.price.trim()) {
    errors.price = 'Укажите цену';
  } else if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Цена должна быть больше нуля';
  }

  const imageUrl = form.imageUrl.trim();

  if (imageUrl && !imageUrl.startsWith('/') && !/^https?:\/\//i.test(imageUrl)) {
    errors.imageUrl = 'Нужна ссылка http(s):// или путь /items/...';
  }

  return errors;
}

export function ResourceFormModal({
  open,
  resource,
  categories,
  onClose,
  onSaved,
}: ResourceFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setForm(
      resource
        ? {
            name: resource.name,
            nameColor: resource.name_color ?? '',
            price: String(resource.min_price),
            categoryIds: resource.category_ids?.length
              ? [...resource.category_ids]
              : resource.category_id
                ? [resource.category_id]
                : [],
            imageUrl: resource.image_url,
          }
        : {
            ...EMPTY_FORM,
            categoryIds: categories[0] ? [categories[0].id] : [],
          },
    );
    setErrors({});
    setApiError(null);
    setSubmitting(false);
    setUploading(false);
    setDragging(false);
    setUploadError(null);
    setUploadNote(null);
    // Сброс формы нужен только при открытии/смене ресурса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (apiError) setApiError(null);
  };

  /** Основная категория — первая в списке; выбор «Без категории» убирает её. */
  const setPrimaryCategory = (value: string) => {
    setForm((current) => {
      const rest = current.categoryIds.slice(1).filter((id) => id !== value);
      return { ...current, categoryIds: value ? [value, ...rest] : rest };
    });
    if (apiError) setApiError(null);
  };

  const setExtraCategory = (index: number, value: string) => {
    setForm((current) => {
      const next = [...current.categoryIds];

      if (index < 1 || index >= next.length) return current;

      if (!value) next.splice(index, 1);
      else next[index] = value;

      return { ...current, categoryIds: next };
    });
    if (apiError) setApiError(null);
  };

  const addCategory = () => {
    setForm((current) => {
      if (current.categoryIds.length >= MAX_CATEGORIES) return current;

      const used = new Set(current.categoryIds);
      const available = categories.find((category) => !used.has(category.id));

      return available
        ? { ...current, categoryIds: [...current.categoryIds, available.id] }
        : current;
    });
    if (apiError) setApiError(null);
  };

  const primaryCategoryId = form.categoryIds[0] ?? '';
  const usedCategoryIds = new Set(form.categoryIds);
  const canAddCategory =
    form.categoryIds.length < MAX_CATEGORIES &&
    categories.some((category) => !usedCategoryIds.has(category.id));

  /** Загрузка выбранного/перетащенного файла: сервер вернёт путь для image_url. */
  const handleFile = async (file: File | undefined) => {
    if (!file || uploading || submitting) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadNote(null);
      setUploadError('Поддерживаются только PNG, JPG, WebP и GIF');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadNote(null);
      setUploadError(`Файл больше 5 МБ (${formatBytes(file.size)}) — уменьшите изображение`);
      return;
    }

    setUploadError(null);
    setUploadNote(null);
    setUploading(true);

    try {
      const uploaded = await uploadImage(file);
      updateField('imageUrl', uploaded.url);
      setUploadNote(`Загружено: ${uploaded.filename} · ${formatBytes(uploaded.size)}`);
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof ApiError
          ? uploadFailure.message
          : 'Не удалось загрузить изображение. Попробуйте ещё раз.',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const categoryIds = form.categoryIds.filter(Boolean);
    const payload = {
      name: form.name.trim(),
      name_color: form.nameColor.trim() || null,
      min_price: Number(form.price.replace(',', '.')),
      category_id: categoryIds[0] ?? null,
      category_ids: categoryIds,
      image_url: form.imageUrl.trim(),
    };

    setSubmitting(true);
    setApiError(null);

    try {
      if (resource) {
        await updateResource(resource.id, payload);
        onSaved(`«${payload.name}» обновлён`);
      } else {
        await createResource(payload);
        onSaved(`«${payload.name}» добавлен в каталог`);
      }
    } catch (submitError) {
      setApiError(
        submitError instanceof ApiError
          ? submitError.message
          : 'Не удалось сохранить ресурс. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewPrice = Number(form.price.replace(',', '.'));
  const previewNameColor = NAME_COLOR_PATTERN.test(form.nameColor.trim())
    ? form.nameColor.trim()
    : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={resource ? 'Редактировать ресурс' : 'Новый ресурс'}
      description={
        resource
          ? 'Измените название, цену, категорию или изображение.'
          : 'Заполните данные предмета — он сразу появится в каталоге.'
      }
      size="lg"
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={submitting}>
            Отмена
          </button>
          <button
            type="submit"
            form="resource-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
            {submitting ? 'Сохраняем…' : resource ? 'Сохранить изменения' : 'Добавить ресурс'}
          </button>
        </>
      }
    >
      <form id="resource-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4">
            <div>
              <label htmlFor="resource-name" className="field-label">
                Название предмета
              </label>
              <input
                id="resource-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Например, Алмаз"
                className={clsx('field', errors.name && 'border-rose-500/60')}
                autoFocus
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'resource-name-error' : undefined}
              />
              {errors.name && (
                <p id="resource-name-error" className="mt-1.5 text-[11px] text-rose-300">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="resource-price" className="field-label">
                  Минимальная цена
                </label>
                <div className="relative">
                  <input
                    id="resource-price"
                    value={form.price}
                    onChange={(event) =>
                      updateField('price', event.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
                    }
                    inputMode="decimal"
                    placeholder="1200"
                    className={clsx('field pr-16', errors.price && 'border-rose-500/60')}
                    aria-invalid={Boolean(errors.price)}
                    aria-describedby={errors.price ? 'resource-price-error' : undefined}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-slate-500">
                    монет
                  </span>
                </div>
                {errors.price && (
                  <p id="resource-price-error" className="mt-1.5 text-[11px] text-rose-300">
                    {errors.price}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="resource-category" className="field-label">
                    Категория
                  </label>
                  <Link
                    to="/admin/categories"
                    className="mb-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 transition hover:text-accent"
                  >
                    <Tags className="h-3 w-3" aria-hidden />
                    Управлять
                  </Link>
                </div>
                <select
                  id="resource-category"
                  value={primaryCategoryId}
                  onChange={(event) => setPrimaryCategory(event.target.value)}
                  className="field"
                >
                  <option value="">Без категории</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {form.categoryIds.slice(1).map((categoryId, index) => {
                  const rowIndex = index + 1;

                  return (
                    <div key={`extra-${rowIndex}`} className="mt-2 flex items-center gap-2">
                      <select
                        value={categoryId}
                        onChange={(event) => setExtraCategory(rowIndex, event.target.value)}
                        className="field flex-1"
                        aria-label={`Дополнительная категория ${rowIndex}`}
                      >
                        {categories
                          .filter(
                            (category) =>
                              category.id === categoryId ||
                              !usedCategoryIds.has(category.id),
                          )
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setExtraCategory(rowIndex, '')}
                        className="icon-btn h-9 w-9 shrink-0 hover:border-rose-500/30 hover:text-rose-300"
                        title="Убрать эту категорию"
                        aria-label="Убрать эту категорию"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addCategory}
                  disabled={!canAddCategory}
                  className="btn btn-secondary mt-2 w-full px-3 py-1.5 text-[11px] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Ещё категория
                </button>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                  Предмет с несколькими категориями виден в каталоге в каждой из них —
                  основная категория задаёт бейдж на карточке.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="resource-name-color" className="field-label">
                Цвет названия{' '}
                <span className="normal-case tracking-normal text-slate-600">(необязательно)</span>
              </label>
              <div className="flex items-center gap-2">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold text-slate-300"
                  style={{ color: readableNameColor(previewNameColor) }}
                  aria-hidden
                >
                  Aa
                </span>
                <input
                  id="resource-name-color"
                  value={form.nameColor}
                  onChange={(event) => updateField('nameColor', event.target.value)}
                  placeholder="#55FFFF"
                  maxLength={7}
                  spellCheck={false}
                  className={clsx(
                    'field font-mono uppercase',
                    errors.nameColor && 'border-rose-500/60',
                  )}
                  aria-invalid={Boolean(errors.nameColor)}
                  aria-describedby={
                    errors.nameColor ? 'resource-name-color-error' : 'resource-name-color-hint'
                  }
                />
              </div>
              {errors.nameColor ? (
                <p id="resource-name-color-error" className="mt-1.5 text-[11px] text-rose-300">
                  {errors.nameColor}
                </p>
              ) : (
                <p
                  id="resource-name-color-hint"
                  className="mt-1.5 text-[11px] text-slate-500"
                >
                  HEX из Minecraft-кодов (#RRGGBB). Пусто — обычный цвет темы; слишком тёмные
                  оттенки осветляются для читаемости.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setPrimaryCategory(category.id)}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition',
                    primaryCategoryId === category.id
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300',
                  )}
                >
                  <Tag className="h-2.5 w-2.5" aria-hidden />
                  {category.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPrimaryCategory('')}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition',
                  primaryCategoryId === ''
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300',
                )}
              >
                <Tag className="h-2.5 w-2.5" aria-hidden />
                Без категории
              </button>
            </div>
          </div>

          <div>
            <span className="field-label">Предпросмотр</span>
            <div className="flex h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-transparent p-3">
              <ItemImage
                key={form.imageUrl}
                src={form.imageUrl}
                alt={form.name || 'Предпросмотр предмета'}
                className="h-16 w-16"
                eager
              />
              <span
                className="line-clamp-2 text-center text-[11px] font-medium text-slate-300"
                style={{ color: readableNameColor(previewNameColor) }}
              >
                {form.name.trim() || 'Название предмета'}
              </span>
              <span className="text-[10px] text-accent">
                {Number.isFinite(previewPrice) && previewPrice > 0
                  ? `${previewPrice.toLocaleString('ru-RU')} монет`
                  : 'цена не указана'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="resource-image" className="field-label">
            Изображение предмета
          </label>
          <div className="relative">
            <Link2
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              id="resource-image"
              value={form.imageUrl}
              onChange={(event) => updateField('imageUrl', event.target.value)}
              placeholder="https://…/diamond.png или /items/diamond.png"
              className={clsx('field pl-10 pr-11', errors.imageUrl && 'border-rose-500/60')}
              aria-invalid={Boolean(errors.imageUrl)}
              aria-describedby={errors.imageUrl ? 'resource-image-error' : 'resource-image-hint'}
            />
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => {
                  updateField('imageUrl', '');
                  setUploadNote(null);
                }}
                className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-500 transition hover:border-rose-500/30 hover:text-rose-300"
                title="Убрать изображение"
                aria-label="Убрать изображение"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          {errors.imageUrl ? (
            <p id="resource-image-error" className="mt-1.5 text-[11px] text-rose-300">
              {errors.imageUrl}
            </p>
          ) : (
            <p id="resource-image-hint" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <ImagePlus className="h-3 w-3" aria-hidden />
              Прямая ссылка на PNG/JPG или локальный путь. Пустое поле — будет плейсхолдер.
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-slate-600">
            <span className="h-px flex-1 bg-white/[0.06]" aria-hidden />
            или файл с компьютера
            <span className="h-px flex-1 bg-white/[0.06]" aria-hidden />
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploading && !submitting) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={clsx(
              'mt-3 flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-4 py-5 text-center transition',
              dragging
                ? 'border-accent/50 bg-accent/[0.06]'
                : 'border-white/[0.09] bg-white/[0.02]',
              (uploading || submitting) && 'opacity-60',
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-accent">
              {uploading ? <Spinner /> : <Upload className="h-4 w-4" aria-hidden />}
            </span>
            <p className="text-xs text-slate-400">
              {uploading
                ? 'Загружаем изображение…'
                : 'Перетащите файл сюда или выберите его на компьютере'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting}
              className="btn btn-secondary px-3 py-1.5 text-xs"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              Выбрать файл
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <p className="text-[10px] leading-relaxed text-slate-600">
              PNG, JPG, WebP или GIF · до 5 МБ · файл сохранится на сервере и подставится в ссылку
            </p>
          </div>

          {uploadError && (
            <p role="alert" className="mt-2 text-[11px] text-rose-300">
              {uploadError}
            </p>
          )}
          {!uploadError && uploadNote && (
            <p className="mt-2 text-[11px] text-accent-300">{uploadNote}</p>
          )}
        </div>

        {apiError && (
          <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300">
            {apiError}
          </p>
        )}
      </form>
    </Modal>
  );
}
