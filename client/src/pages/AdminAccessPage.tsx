import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, deletePrefix, deleteRole, fetchPrefixes, fetchRoles } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { pluralize } from '../lib/format';
import type { AdminPrefixInfo, AdminRoleInfo, PermissionMeta } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { RoleFormModal } from '../components/admin/RoleFormModal';
import { PrefixFormModal } from '../components/admin/PrefixFormModal';
import { Modal } from '../components/ui/Modal';
import { PageLoader, Spinner } from '../components/ui/Spinner';

type ConfirmTarget = { type: 'role'; item: AdminRoleInfo } | { type: 'prefix'; item: AdminPrefixInfo };

export function AdminAccessPage() {
  const { can } = useAuth();
  const { notify } = useToast();

  const [roles, setRoles] = useState<AdminRoleInfo[]>([]);
  const [prefixes, setPrefixes] = useState<AdminPrefixInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleModal, setRoleModal] = useState<{ open: boolean; role: AdminRoleInfo | null }>({
    open: false,
    role: null,
  });
  const [prefixModal, setPrefixModal] = useState<{
    open: boolean;
    prefix: AdminPrefixInfo | null;
  }>({ open: false, prefix: null });
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canRoles = can('roles.manage');
  const canPrefixes = can('prefixes.manage');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [rolesResponse, prefixesResponse] = await Promise.all([fetchRoles(), fetchPrefixes()]);
      setRoles(rolesResponse.data);
      setPermissions(rolesResponse.meta.permissions);
      setPrefixes(prefixesResponse);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось загрузить роли и префиксы',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Доступ и роли — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function handleDelete() {
    if (!confirm) return;

    setDeleting(true);

    try {
      if (confirm.type === 'role') {
        await deleteRole(confirm.item.id);
        notify(`Роль «${confirm.item.name}» удалена`, 'success');
      } else {
        await deletePrefix(confirm.item.id);
        notify(`Префикс «${confirm.item.name}» удалён`, 'success');
      }

      setConfirm(null);
      await load(true);
    } catch (requestError) {
      notify(
        requestError instanceof ApiError ? requestError.message : 'Не удалось удалить запись',
        'error',
      );
    } finally {
      setDeleting(false);
    }
  }

  const roleSaved = (message: string) => {
    notify(message, 'success');
    void load(true);
  };

  const prefixSaved = (message: string) => {
    notify(message, 'success');
    void load(true);
  };

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              RBAC
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Роли, права и префиксы
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Создавайте роли с точным набором прав и выдавайте администраторам префиксы.
              Владелец всегда имеет полный доступ, системные роли защищены от удаления.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            className="btn btn-secondary shrink-0"
            disabled={loading}
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            Обновить
          </button>
        </div>

        {error && !loading ? (
          <div className="panel mt-6 flex flex-col items-center px-6 py-12 text-center">
            <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить доступ</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => void load()} className="btn btn-primary mt-5">
              Попробовать снова
            </button>
          </div>
        ) : loading ? (
          <PageLoader label="Загружаем роли и префиксы…" />
        ) : (
          <>
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
                    Роли и права
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {roles.length} {pluralize(roles.length, ['роль', 'роли', 'ролей'])} · права
                    проверяются на сервере для каждого действия
                  </p>
                </div>
                {canRoles && (
                  <button
                    type="button"
                    onClick={() => setRoleModal({ open: true, role: null })}
                    className="btn btn-primary"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Создать роль
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {roles.map((role) => (
                  <article key={role.id} className="panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{role.name}</h3>
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-slate-500">
                            {role.code}
                          </span>
                          <span
                            className="rounded-full border border-accent/25 bg-accent/[0.09] px-2 py-0.5 text-[9px] font-semibold text-accent"
                            title="Уровень доступа роли — с него открываются разделы в «Панели управления»"
                          >
                            ур. {role.access_level}
                          </span>
                          {role.is_system && (
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-2 py-0.5 text-[9px] uppercase tracking-wider text-cyan-300">
                              системная
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                          {role.description ?? 'Описание не задано.'}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        {role.code !== 'owner' && (
                          <button
                            type="button"
                            onClick={() => setRoleModal({ open: true, role })}
                            disabled={!canRoles}
                            className="icon-btn"
                            title={`Редактировать роль «${role.name}»`}
                            aria-label={`Редактировать роль ${role.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirm({ type: 'role', item: role })}
                          disabled={!canRoles || role.is_system}
                          className="icon-btn hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                          title={`Удалить роль «${role.name}»`}
                          aria-label={`Удалить роль ${role.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="h-3 w-3" aria-hidden />
                        {role.user_count}{' '}
                        {pluralize(role.user_count, ['администратор', 'администратора', 'администраторов'])}
                      </span>
                      <span className="text-slate-700">·</span>
                      <span>
                        {role.permissions.includes('*')
                          ? 'полный доступ'
                          : `${role.permissions.length} ${pluralize(role.permissions.length, ['право', 'права', 'прав'])}`}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {role.permissions.includes('*') ? (
                        <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
                          *
                        </span>
                      ) : role.permissions.length === 0 ? (
                        <span className="text-[10px] text-slate-600">Нет прав</span>
                      ) : (
                        role.permissions.map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] text-slate-400"
                          >
                            {permission}
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Sparkles className="h-5 w-5 text-amber-300" aria-hidden />
                    Префиксы
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Цвет и приоритет отображения звания администратора
                  </p>
                </div>
                {canPrefixes && (
                  <button
                    type="button"
                    onClick={() => setPrefixModal({ open: true, prefix: null })}
                    className="btn btn-primary"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Создать префикс
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {prefixes.map((prefix) => (
                  <article key={prefix.id} className="panel flex items-start gap-3 p-4">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"
                      style={{
                        color: prefix.color,
                        borderColor: `${prefix.color}55`,
                        backgroundColor: `${prefix.color}14`,
                      }}
                    >
                      <Sparkles className="h-4 w-4" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold" style={{ color: prefix.color }}>
                          {prefix.name}
                        </h3>
                        {prefix.is_system && (
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-500">
                            system
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        приоритет {prefix.priority} · {prefix.user_count}{' '}
                        {pluralize(prefix.user_count, ['админ', 'админа', 'админов'])}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-slate-600">{prefix.color}</p>
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrefixModal({ open: true, prefix })}
                        disabled={!canPrefixes}
                        className="icon-btn"
                        title={`Редактировать префикс «${prefix.name}»`}
                        aria-label={`Редактировать префикс ${prefix.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ type: 'prefix', item: prefix })}
                        disabled={!canPrefixes || prefix.is_system}
                        className="icon-btn hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                        title={`Удалить префикс «${prefix.name}»`}
                        aria-label={`Удалить префикс ${prefix.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <p className="mt-6 text-[11px] leading-relaxed text-slate-600">
              Изменения прав применяются к следующему запросу администратора: роль перечитывается
              из базы, а не берётся из JWT. Системные роли и префиксы удалить нельзя.
            </p>
          </>
        )}
      </main>

      <RoleFormModal
        open={roleModal.open}
        role={roleModal.role}
        permissions={permissions}
        onClose={() => setRoleModal({ open: false, role: null })}
        onSaved={roleSaved}
      />

      <PrefixFormModal
        open={prefixModal.open}
        prefix={prefixModal.prefix}
        onClose={() => setPrefixModal({ open: false, prefix: null })}
        onSaved={prefixSaved}
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Удалить запись?"
        description={
          confirm
            ? `«${confirm.item.name}» будет удалена. Действие записывается в журнал.`
            : ''
        }
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost">
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="btn btn-danger"
            >
              {deleting ? <Spinner /> : null}
              Удалить
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-400">
          {confirm?.type === 'role'
            ? 'Администраторы, у которых была эта роль, останутся без неё и потеряют доступ к соответствующим разделам.'
            : 'У администраторов, использовавших этот префикс, он исчезнет из отображения.'}
        </p>
      </Modal>
    </div>
  );
}
