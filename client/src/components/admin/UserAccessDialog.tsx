import { useEffect, useState } from 'react';
import { Save, ShieldCheck, Sparkles } from 'lucide-react';
import { ApiError, fetchPrefixes, fetchRoles, updateUserAccess } from '../../lib/api';
import type { AdminPrefixInfo, AdminRoleInfo, AdminUser } from '../../types';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface UserAccessDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onUpdated: (user: AdminUser) => void;
  /** Редактирование самого себя: меняем только префикс, роль заморожена. */
  selfMode?: boolean;
}

export function UserAccessDialog({ user, onClose, onUpdated, selfMode = false }: UserAccessDialogProps) {
  const [roles, setRoles] = useState<AdminRoleInfo[]>([]);
  const [prefixes, setPrefixes] = useState<AdminPrefixInfo[]>([]);
  const [roleId, setRoleId] = useState('');
  const [prefixId, setPrefixId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setRoleId(user.role_id ?? '');
    setPrefixId(user.prefix?.id ?? '');
    setError(null);
    setLoading(true);

    Promise.all([fetchRoles(), fetchPrefixes()])
      .then(([rolesResponse, prefixesResponse]) => {
        setRoles(rolesResponse.data);
        setPrefixes(prefixesResponse);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Не удалось загрузить роли и префиксы',
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await updateUserAccess(user.id, {
        role_id: selfMode ? (user.role_id ?? null) : roleId || null,
        prefix_id: prefixId || null,
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Не удалось сохранить доступ',
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedRole = roles.find((role) => role.id === roleId);
  const selectedPrefix = prefixes.find((prefix) => prefix.id === prefixId);

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={user ? (selfMode ? `Свой префикс: ${user.login}` : `Доступ: ${user.login}`) : 'Доступ'}
      description={
        selfMode
          ? 'Здесь можно выбрать своё отображаемое звание. Роль меняет только другой владелец.'
          : 'Роль определяет разделы и действия, префикс — отображаемое звание в панели и на главной.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="btn btn-primary"
            disabled={saving || loading}
          >
            {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Spinner className="h-5 w-5 text-accent" />
          Загружаем роли…
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}

          {selfMode ? (
            <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-[11px] leading-relaxed text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span>
                Роль: <span className="font-semibold text-slate-200">{user?.role_name ?? 'не задана'}</span>.
                Свою роль менять нельзя — это делает другой владелец. Ниже можно выбрать префикс.
              </span>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="field-label">Роль</span>
                <select
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="field"
                >
                  <option value="">Без роли (нет доступа к разделам)</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} · {role.code} · {role.user_count}{' '}
                      {role.user_count === 1 ? 'администратор' : 'администраторов'}
                    </option>
                  ))}
                </select>
              </label>

              {selectedRole && (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                    {selectedRole.name}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {selectedRole.description ?? 'Описание не задано.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedRole.permissions.includes('*') ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
                        Полный доступ
                      </span>
                    ) : selectedRole.permissions.length === 0 ? (
                      <span className="text-[10px] text-slate-600">Нет разрешённых действий</span>
                    ) : (
                      selectedRole.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-slate-400"
                        >
                          {permission}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <label className="block">
            <span className="field-label">Префикс</span>
            <select
              value={prefixId}
              onChange={(event) => setPrefixId(event.target.value)}
              className="field"
            >
              <option value="">Без префикса</option>
              {prefixes.map((prefix) => (
                <option key={prefix.id} value={prefix.id}>
                  {prefix.name} · приоритет {prefix.priority}
                </option>
              ))}
            </select>
          </label>

          {selectedPrefix && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
              <Sparkles className="h-4 w-4" style={{ color: selectedPrefix.color }} aria-hidden />
              <span className="text-sm font-semibold" style={{ color: selectedPrefix.color }}>
                {selectedPrefix.name}
              </span>
              <span className="text-xs text-slate-500">· {user?.login}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
