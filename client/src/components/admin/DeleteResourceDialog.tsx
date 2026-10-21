import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ApiError, deleteResource } from '../../lib/api';
import type { Resource } from '../../types';
import { formatPrice } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { ItemImage } from '../ui/ItemImage';

interface DeleteResourceDialogProps {
  resource: Resource | null;
  onClose: () => void;
  onDeleted: (resource: Resource) => void;
}

export function DeleteResourceDialog({ resource, onClose, onDeleted }: DeleteResourceDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resource) {
      setDeleting(false);
      setError(null);
    }
  }, [resource]);

  const handleDelete = async () => {
    if (!resource || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteResource(resource.id);
      onDeleted(resource);
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Не удалось удалить ресурс. Попробуйте ещё раз.',
      );
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) onClose();
  };

  return (
    <Modal
      open={Boolean(resource)}
      onClose={handleClose}
      title="Удалить ресурс?"
      description="Предмет исчезнет из каталога и калькулятора и попадёт в «Удалённые предметы» — оттуда его можно вернуть. Импорт прайса его не восстановит."
      size="sm"
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={deleting}>
            Отмена
          </button>
          <button type="button" onClick={() => void handleDelete()} className="btn btn-danger" disabled={deleting}>
            {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
            {deleting ? 'Удаляем…' : 'Удалить'}
          </button>
        </>
      }
    >
      {resource && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <ItemImage src={resource.image_url} alt={resource.name} className="h-16 w-16" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{resource.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {resource.category} · {formatPrice(resource.min_price)} монет
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Если предмет используется в трейдах, их расчёт изменится. Это нормально — цены
            обновятся автоматически.
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
