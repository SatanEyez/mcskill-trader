import { useEffect, useState } from 'react';
import { AlertTriangle, UserMinus } from 'lucide-react';
import { ApiError, deleteUser } from '../../lib/api';
import type { AdminUser } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface DeleteUserDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onDeleted: (user: AdminUser) => void;
}

export function DeleteUserDialog({ user, onClose, onDeleted }: DeleteUserDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDeleting(false);
      setError(null);
    }
  }, [user]);

  const handleDelete = async () => {
    if (!user || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const deleted = await deleteUser(user.id);
      onDeleted(deleted);
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Не удалось удалить администратора. Попробуйте ещё раз.',
      );
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) onClose();
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={handleClose}
      title="Удалить администратора?"
      description="Аккаунт будет удалён безвозвратно, история действий в журнале сохранится."
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
            {deleting ? <Spinner /> : <UserMinus className="h-4 w-4" aria-hidden />}
            {deleting ? 'Удаляем…' : 'Удалить'}
          </button>
        </>
      }
    >
      {user && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/[0.08] text-sm font-semibold uppercase text-rose-300">
              {user.login.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.login}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {user.status === 'pending'
                  ? 'Заявка ещё не одобрена'
                  : user.status === 'rejected'
                    ? 'Заявка отклонена'
                    : 'Доступ к админ-панели активен'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Если аккаунт одобрен, его владелец потеряет доступ сразу после удаления.
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
