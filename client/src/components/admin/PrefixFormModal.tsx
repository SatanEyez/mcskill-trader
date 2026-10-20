import { useEffect, useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { ApiError, createPrefix, updatePrefix } from '../../lib/api';
import type { AdminPrefixInfo } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface PrefixFormModalProps {
  open: boolean;
  prefix: AdminPrefixInfo | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function PrefixFormModal({ open, prefix, onClose, onSaved }: PrefixFormModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#34D399');
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setName(prefix?.name ?? '');
    setColor(prefix?.color ?? '#34D399');
    setPriority(prefix?.priority ?? 0);
    setError(null);
  }, [open, prefix]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      if (prefix) {
        await updatePrefix(prefix.id, { name: name.trim(), color, priority });
        onSaved(`Префикс «${name.trim()}» обновлён`);
      } else {
        await createPrefix({ name: name.trim(), color, priority });
        onSaved(`Префикс «${name.trim()}» создан`);
      }
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось сохранить префикс',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prefix ? `Префикс «${prefix.name}»` : 'Новый префикс'}
      description="Префикс показывается перед ником администратора в панели и в блоке «В сети администраторы»."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="btn btn-primary"
            disabled={saving || name.trim().length < 2}
          >
            {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Название</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Модератор"
              maxLength={40}
              className="field"
            />
          </label>

          <label className="block">
            <span className="field-label">Цвет</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-void/60 p-1"
                aria-label="Цвет префикса"
              />
              <input
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                maxLength={7}
                className="field font-mono text-xs"
                aria-label="HEX-цвет префикса"
              />
            </div>
          </label>
        </div>

        <label className="block">
          <span className="field-label">Приоритет сортировки</span>
          <input
            type="number"
            value={priority}
            onChange={(event) => setPriority(Number(event.target.value))}
            min={-100}
            max={100}
            className="field"
          />
          <span className="mt-1 block text-[10px] text-slate-600">
            Чем больше число, тем выше префикс в списке администраторов онлайн.
          </span>
        </label>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Предпросмотр</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold" style={{ color }}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {name.trim() || 'Префикс'} · admin
          </p>
        </div>
      </div>
    </Modal>
  );
}
