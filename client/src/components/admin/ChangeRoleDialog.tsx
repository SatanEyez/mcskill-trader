import { useEffect, useState } from 'react';
import { AlertTriangle, Crown, UserMinus } from 'lucide-react';
import { ApiError, changeUserRole } from '../../lib/api';
import type { AdminRole, AdminUser } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface ChangeRoleDialogProps {
  /** Кому меняем роль. */
  user: AdminUser | null;
  /** Целевая роль: `owner` — полный доступ, `admin` — обычные права. */
  role: AdminRole | null;
  onClose: () => void;
  onChanged: (user: AdminUser) => void;
}

const ROLE_COPY: Record<AdminRole, { title: string; description: string; warning: string }> = {
  owner: {
    title: 'Выдать полный доступ?',
    description:
      'Владелец управляет каталогом и категориями, одобряет заявки, удаляет администраторов и меняет роли.',
    warning: 'Полный доступ нельзя ограничить — снять его можно только сменой роли или удалением.',
  },
  admin: {
    title: 'Понизить до администратора?',
    description:
      'Администратор управляет каталогом, категориями и заявками, но не может удалять одобренных администраторов и менять роли.',
    warning: 'Права владельца пропадут сразу после сохранения, вход останется доступен.',
  },
};

export function ChangeRoleDialog({ user, role, onClose, onChanged }: ChangeRoleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && role) {
      setSaving(false);
      setError(null);
    }
  }, [user, role]);

  const handleSubmit = async () => {
    if (!user || !role || saving) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await changeUserRole(user.id, role);
      onChanged(updated);
    } catch (changeError) {
      setError(
        changeError instanceof ApiError
          ? changeError.message
          : 'Не удалось изменить роль. Попробуйте ещё раз.',
      );
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  const copy = role ? ROLE_COPY[role] : null;
  const promoting = role === 'owner';

  return (
    <Modal
      open={Boolean(user && role)}
      onClose={handleClose}
      title={copy?.title ?? 'Сменить роль'}
      description={copy?.description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className={promoting ? 'btn btn-primary' : 'btn btn-secondary'}
            disabled={saving}
          >
            {saving ? <Spinner /> : promoting ? (
              <Crown className="h-4 w-4" aria-hidden />
            ) : (
              <UserMinus className="h-4 w-4" aria-hidden />
            )}
            {saving
              ? 'Сохраняем…'
              : promoting
                ? 'Сделать владельцем'
                : 'Понизить до администратора'}
          </button>
        </>
      }
    >
      {user && copy && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span
              className={
                promoting
                  ? 'grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.08] text-sm font-semibold uppercase text-fuchsia-300'
                  : 'grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm font-semibold uppercase text-slate-300'
              }
            >
              {user.login.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.login}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {user.role === 'owner' ? 'Сейчас владелец' : 'Сейчас администратор'}
                {' · '}
                {promoting ? 'станет владельцем' : 'станет администратором'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {copy.warning}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
