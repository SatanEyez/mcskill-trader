import { useEffect, useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';
import clsx from 'clsx';
import { ApiError, createRole, updateRole } from '../../lib/api';
import type { AdminRoleInfo, PermissionMeta } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface RoleFormModalProps {
  open: boolean;
  role: AdminRoleInfo | null;
  permissions: PermissionMeta[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  access_level: number;
}

export function RoleFormModal({
  open,
  role,
  permissions,
  onClose,
  onSaved,
}: RoleFormModalProps) {
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    description: '',
    permissions: [],
    access_level: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setForm({
      code: role?.code ?? '',
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role?.permissions.filter((permission) => permission !== '*') ?? [],
      access_level: role?.access_level ?? 10,
    });
    setError(null);
  }, [open, role]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionMeta[]>();

    for (const permission of permissions) {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }

    return Array.from(map.entries());
  }, [permissions]);

  const isOwner = role?.code === 'owner';
  const isEdit = role !== null;

  function togglePermission(key: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((item) => item !== key)
        : [...current.permissions, key],
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        await updateRole(role.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          permissions: form.permissions,
          access_level: form.access_level,
        });
        onSaved(`Роль «${form.name.trim()}» обновлена`);
      } else {
        await createRole({
          code: form.code.trim().toLowerCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          permissions: form.permissions,
          access_level: form.access_level,
        });
        onSaved(`Роль «${form.name.trim()}» создана`);
      }
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Не удалось сохранить роль',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Роль «${role.name}»` : 'Новая роль'}
      description="Отметьте действия, которые доступны этой роли. Владелец всегда имеет полный доступ."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="btn btn-primary"
            disabled={saving || isOwner || form.name.trim().length < 2 || (!isEdit && form.code.trim().length < 2)}
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

        {isOwner ? (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5 text-xs text-amber-100/85">
            Роль владельца системная: её права всегда «всё разрешено». Создайте отдельную роль,
            если нужно ограничить доступ.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Название</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Модератор чата"
              maxLength={60}
              className="field"
              disabled={isOwner}
            />
          </label>

          <label className="block">
            <span className="field-label">Код (латиница)</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="chat_moderator"
              maxLength={40}
              className="field font-mono text-xs"
              disabled={isEdit || isOwner}
            />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Описание</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Что делает эта роль и кому она подходит"
            maxLength={500}
            rows={2}
            className="field resize-y"
            disabled={isOwner}
          />
        </label>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="field-label mb-0">Уровень доступа</span>
            <span className="font-mono text-[11px] text-accent">{form.access_level}</span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.access_level}
              onChange={(event) =>
                setForm((current) => ({ ...current, access_level: Number(event.target.value) }))
              }
              disabled={isOwner}
              aria-label="Уровень доступа роли"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#34d399] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={form.access_level}
              onChange={(event) => {
                const next = Number(event.target.value);
                setForm((current) => ({
                  ...current,
                  access_level: Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 0,
                }));
              }}
              disabled={isOwner}
              className="field w-20 py-1.5 text-center text-sm"
              aria-label="Уровень доступа числом"
            />
          </div>

          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            Чем выше уровень, тем больше разделов открыто. Ориентиры: 10 — базовый, 20 — стажёр,
            40 — поддержка, 60 — модератор, 80 — администратор, 100 — владелец. Карточки в
            «Панели управления» показывают, с какого уровня открывается каждый раздел.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="field-label mb-0">Права доступа</span>
            <span className="text-[11px] text-slate-500">
              выбрано {form.permissions.length} из {permissions.length}
            </span>
          </div>

          <div className="mt-2 space-y-4">
            {groups.map(([group, items]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {group}
                </p>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map((permission) => {
                    const checked = form.permissions.includes(permission.key);

                    return (
                      <button
                        key={permission.key}
                        type="button"
                        onClick={() => togglePermission(permission.key)}
                        disabled={isOwner}
                        className={clsx(
                          'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition',
                          checked
                            ? 'border-accent/35 bg-accent/[0.07]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15',
                          isOwner && 'cursor-not-allowed opacity-60',
                        )}
                        aria-pressed={checked}
                      >
                        <span
                          className={clsx(
                            'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border',
                            checked
                              ? 'border-accent/50 bg-accent text-[#04110c]'
                              : 'border-white/15 bg-transparent text-transparent',
                          )}
                        >
                          <Check className="h-3 w-3" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-medium text-slate-200">
                            {permission.label}
                          </span>
                          <span className="block truncate font-mono text-[9px] text-slate-600">
                            {permission.key}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
