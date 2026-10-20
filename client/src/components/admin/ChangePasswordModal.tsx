import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const PASSWORD_MIN = 6;

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const { notify } = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (next.length < PASSWORD_MIN) {
      setError(`Новый пароль должен содержать минимум ${PASSWORD_MIN} символов`);
      return;
    }

    if (next !== confirm) {
      setError('Новые пароли не совпадают');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await changePassword(current, next);
      notify('Пароль обновлён. Сессия продлена', 'success');
      onClose();
    } catch (changeError) {
      setError(
        changeError instanceof ApiError
          ? changeError.message
          : 'Не удалось изменить пароль. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Смена пароля"
      description="После смены пароля все остальные сессии завершатся автоматически."
      size="sm"
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={submitting}>
            Отмена
          </button>
          <button
            type="submit"
            form="change-password-form"
            className="btn btn-primary"
            disabled={submitting || !current || !next || !confirm}
          >
            {submitting ? <Spinner /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            {submitting ? 'Сохраняем…' : 'Сменить пароль'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="current-password" className="field-label">
            Текущий пароль
          </label>
          <input
            id="current-password"
            type="password"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="current-password"
            autoFocus
            className="field"
          />
        </div>

        <div>
          <label htmlFor="new-password" className="field-label">
            Новый пароль
          </label>
          <input
            id="new-password"
            type="password"
            value={next}
            onChange={(event) => {
              setNext(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="new-password"
            className="field"
          />
          <p className="mt-1.5 text-[11px] text-slate-500">Минимум {PASSWORD_MIN} символов.</p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="field-label">
            Повторите новый пароль
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="new-password"
            className="field"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost px-3 py-2 text-xs text-slate-400 hover:text-white"
        title="Сменить пароль"
      >
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden lg:inline">Пароль</span>
      </button>

      <ChangePasswordModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
