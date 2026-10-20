import { useEffect, useState } from 'react';
import { AlertTriangle, FolderMinus, Trash2 } from 'lucide-react';
import { ApiError, deleteCategory } from '../../lib/api';
import type { Category } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface DeleteCategoryDialogProps {
  category: Category | null;
  onClose: () => void;
  onDeleted: (category: Category, movedResources: number) => void;
}

export function DeleteCategoryDialog({ category, onClose, onDeleted }: DeleteCategoryDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setDeleting(false);
      setError(null);
    }
  }, [category]);

  const handleDelete = async () => {
    if (!category || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const result = await deleteCategory(category.id);
      onDeleted(category, result.moved_resources);
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Не удалось удалить категорию. Попробуйте ещё раз.',
      );
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) onClose();
  };

  return (
    <Modal
      open={Boolean(category)}
      onClose={handleClose}
      title="Удалить категорию?"
      description="Ресурсы не удалятся — они перейдут в «Без категории»."
      size="sm"
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={deleting}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="btn btn-danger"
            disabled={deleting}
          >
            {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
            {deleting ? 'Удаляем…' : 'Удалить категорию'}
          </button>
        </>
      }
    >
      {category && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/[0.08]">
              <FolderMinus className="h-5 w-5 text-rose-300" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{category.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {category.resource_count > 0
                  ? `${category.resource_count} ${category.resource_count === 1 ? 'ресурс' : 'ресурсов'}`
                  : 'Пустая категория'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {category.resource_count > 0
              ? `${category.resource_count} ${category.resource_count === 1 ? 'ресурс перейдёт' : 'ресурсов перейдут'} в «Без категории». Их можно будет назначить в другую категорию.`
              : 'Категория пуста — удаление ни на что не повлияет.'}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
