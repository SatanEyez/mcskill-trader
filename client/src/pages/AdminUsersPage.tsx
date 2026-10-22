import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock4,
  Crown,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserMinus,
  UserRoundPlus,
  UsersRound,
  UserX,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, approveUser, rejectUser } from '../lib/api';
import { formatDateTimeMsk, formatDuration, pluralize } from '../lib/format';
import { showsRole } from '../lib/identity';
import { notifyUsersChanged, useAdminUsers } from '../hooks/useAdminUsers';
import { useStaff } from '../hooks/useStaff';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { AdminRole, AdminStatus, AdminUser } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { ChangeRoleDialog } from '../components/admin/ChangeRoleDialog';
import { DeleteUserDialog } from '../components/admin/DeleteUserDialog';
import { StaffListPanel } from '../components/admin/StaffListPanel';
import { UserAccessDialog } from '../components/admin/UserAccessDialog';
import { PrefixName } from '../components/ui/PrefixName';
import { PageLoader } from '../components/ui/Spinner';

type UsersView = 'accounts' | 'staff';

const STATUS_META: Record<AdminStatus, { label: string; className: string }> = {
  pending: {
    label: 'Ожидает одобрения',
    className: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300',
  },
  approved: {
    label: 'Одобрен',
    className: 'border-accent/25 bg-accent/[0.08] text-accent-300',
  },
  rejected: {
    label: 'Отклонён',
    className: 'border-rose-500/25 bg-rose-500/[0.08] text-rose-300',
  },
};

const AVATAR_META: Record<AdminStatus, string> = {
  pending: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
  approved: 'border-accent/20 bg-accent/[0.08] text-accent',
  rejected: 'border-rose-500/20 bg-rose-500/[0.08] text-rose-300',
};

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'approved', label: 'Одобрены' },
  { value: 'rejected', label: 'Отклонены' },
] as const;

function requestCountLabel(count: number): string {
  return `${count} ${pluralize(count, ['заявка', 'заявки', 'заявок'])}`;
}

export function AdminUsersPage() {
  const [filter, setFilter] = useState<AdminStatus | 'all'>('all');
  const [view, setView] = useState<UsersView>('accounts');
  const { users, counts, loading, error, reload } = useAdminUsers(filter);
  const {
    staff,
    meta: staffMeta,
    loading: staffLoading,
    error: staffError,
    reload: reloadStaff,
  } = useStaff(view === 'staff');
  const { user: currentUser, can } = useAuth();
  const { notify } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [accessUser, setAccessUser] = useState<AdminUser | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: AdminUser; role: AdminRole } | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Пользователи — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const filterCounts: Record<(typeof FILTERS)[number]['value'], number> = {
    all: counts.total,
    pending: counts.pending,
    approved: counts.approved,
    rejected: counts.rejected,
  };

  const handleApprove = async (target: AdminUser) => {
    if (busyId) return;
    setBusyId(target.id);

    try {
      await approveUser(target.id);
      notify(`Доступ для «${target.login}» одобрен`, 'success');
      notifyUsersChanged();
      await reload({ silent: true });
      void reloadStaff({ silent: true });
    } catch (approveError) {
      notify(
        approveError instanceof ApiError
          ? approveError.message
          : 'Не удалось одобрить заявку',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (target: AdminUser) => {
    if (busyId) return;
    setBusyId(target.id);

    try {
      await rejectUser(target.id);
      notify(`Заявка «${target.login}» отклонена`, 'info');
      notifyUsersChanged();
      await reload({ silent: true });
      void reloadStaff({ silent: true });
    } catch (rejectError) {
      notify(
        rejectError instanceof ApiError ? rejectError.message : 'Не удалось отклонить заявку',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleted = (deleted: AdminUser) => {
    setDeletingUser(null);
    notify(`Администратор «${deleted.login}» удалён`, 'success');
    notifyUsersChanged();
    void reload({ silent: true });
    void reloadStaff({ silent: true });
  };

  const handleRoleChanged = (updated: AdminUser) => {
    setRoleChange(null);
    notify(
      updated.role === 'owner'
        ? `«${updated.login}» получил полный доступ`
        : `«${updated.login}» понижен до администратора`,
      'success',
    );
    notifyUsersChanged();
    void reload({ silent: true });
    void reloadStaff({ silent: true });
  };

  const handleAccessUpdated = (updated: AdminUser) => {
    setAccessUser(null);
    notify(`Доступ «${updated.login}» обновлён`, 'success');
    notifyUsersChanged();
    void reload({ silent: true });
    void reloadStaff({ silent: true });
  };

  const canDelete = (target: AdminUser): boolean =>
    can('users.delete') &&
    target.role !== 'owner' &&
    !target.is_system &&
    target.id !== currentUser?.id;

  /** Гибкие роли и префиксы меняет носитель права users.roles. */
  const canManageRoles = (target: AdminUser): boolean =>
    can('users.roles') && !target.is_system;

  /** Свою роль менять нельзя, только префикс (правило продублировано на сервере). */
  const canChangeRole = (target: AdminUser): boolean =>
    canManageRoles(target) && target.id !== currentUser?.id;

  /** Кто и когда принял решение по заявке: логин приходит снимком с сервера. */
  const renderReview = (target: AdminUser) => {
    if (target.status === 'approved') {
      return target.reviewed_by_login ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.07] px-2 py-0.5 text-[10px] text-accent-300">
          <UserCheck className="h-3 w-3" aria-hidden />
          Одобрил {target.reviewed_by_login}
          {target.reviewed_at && (
            <span className="text-slate-500">· {formatDateTimeMsk(target.reviewed_at)}</span>
          )}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">
          <UserCheck className="h-3 w-3" aria-hidden />
          Доступ выдан при первом запуске
        </span>
      );
    }

    if (target.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-2 py-0.5 text-[10px] text-rose-300">
          <UserX className="h-3 w-3" aria-hidden />
          Отклонил {target.reviewed_by_login ?? 'администратор'}
          {target.reviewed_at && (
            <span className="text-slate-500">· {formatDateTimeMsk(target.reviewed_at)}</span>
          )}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] text-amber-300">
        <Clock4 className="h-3 w-3" aria-hidden />
        Ждёт решения
      </span>
    );
  };

  const renderMeta = (target: AdminUser): string => {
    const parts: string[] = [`заявка от ${formatDateTimeMsk(target.created_at)}`];

    parts.push(
      target.last_login_at
        ? `последний вход ${formatDateTimeMsk(target.last_login_at)}`
        : 'ещё не входил',
    );

    if (target.is_online) {
      parts.push('сейчас в сети');
    } else if (target.last_seen_at) {
      parts.push(`был(а) в сети ${formatDateTimeMsk(target.last_seen_at)}`);
    }

    if (target.online_seconds > 0) {
      parts.push(`всего в сети ${formatDuration(target.online_seconds)}`);
    }

    return parts.join(' · ');
  };

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Доступ в панель
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Пользователи
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Новые аккаунты попадают сюда после регистрации. Одобрите заявку, чтобы открыть
              доступ к админ-панели. Все решения записываются в журнал.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (view === 'staff') void reloadStaff({ silent: true });
              else void reload({ silent: true });
            }}
            className="btn btn-secondary shrink-0"
            disabled={view === 'staff' ? staffLoading : loading}
          >
            <RefreshCw
              className={clsx(
                'h-4 w-4',
                (view === 'staff' ? staffLoading : loading) && 'animate-spin',
              )}
              aria-hidden
            />
            Обновить
          </button>
        </div>

        <div className="mt-6 inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          <button
            type="button"
            onClick={() => setView('accounts')}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition',
              view === 'accounts'
                ? 'bg-white/[0.06] text-white'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <UsersRound className="h-3.5 w-3.5" aria-hidden />
            Аккаунты
            <span className="text-[10px] text-slate-500">{counts.total}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('staff')}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition',
              view === 'staff'
                ? 'bg-white/[0.06] text-white'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden />
            Состав
            <span className="text-[10px] text-slate-500">{counts.approved}</span>
          </button>
        </div>

        {view === 'staff' ? (
          <StaffListPanel
            staff={staff}
            meta={staffMeta}
            pendingCount={counts.pending}
            loading={staffLoading}
            error={staffError}
            currentUserId={currentUser?.id}
            can={can}
            busyId={busyId}
            reload={reloadStaff}
            onShowPending={() => {
              setView('accounts');
              setFilter('pending');
            }}
            onAccess={setAccessUser}
            onDelete={setDeletingUser}
            onRoleChange={(user, role) => setRoleChange({ user, role })}
          />
        ) : (
          <>
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Ожидают
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
                <Clock4 className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : counts.pending}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">заявок на доступ</p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Одобрены
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/20 bg-accent/[0.08] text-accent">
                <UserCheck className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : counts.approved}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">активных аккаунтов</p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Отклонены
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/[0.08] text-rose-300">
                <UserX className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : counts.rejected}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">заявок отклонено</p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Всего
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
                <UsersRound className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-white">
              {loading ? '—' : counts.total}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">аккаунтов в системе</p>
          </div>
        </div>

        {counts.pending > 0 && filter !== 'pending' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {requestCountLabel(counts.pending)} ожидают вашего решения.
            </span>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              Показать заявки
            </button>
          </div>
        )}

        <div className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b border-white/[0.05] p-4">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                  filter === item.value
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300',
                )}
              >
                {item.label}
                <span className="text-[10px] opacity-70">{filterCounts[item.value]}</span>
              </button>
            ))}
          </div>

          {error && users.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void reload()}
                className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Повторить
              </button>
            </div>
          )}

          {error && !loading && users.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">
                Не удалось загрузить администраторов
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : loading && users.length === 0 ? (
            <PageLoader label="Загружаем администраторов…" />
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <UserRoundPlus className="h-6 w-6 text-slate-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">
                {filter === 'pending' ? 'Новых заявок нет' : 'Список пуст'}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                {filter === 'pending'
                  ? 'Как только кто-то зарегистрируется, заявка появится здесь.'
                  : 'Попробуйте выбрать другой фильтр.'}
              </p>
              {filter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="btn btn-secondary mt-5"
                >
                  Показать всех
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {users.map((target) => {
                const statusMeta = STATUS_META[target.status];
                const busy = busyId === target.id;
                const isSelf = target.id === currentUser?.id;

                return (
                  <li
                    key={target.id}
                    className="flex flex-col gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={clsx(
                          'relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border text-sm font-semibold uppercase',
                          AVATAR_META[target.status],
                        )}
                      >
                        {target.avatar_url ? (
                          <img
                            src={target.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                            aria-hidden
                          />
                        ) : (
                          target.login.slice(0, 1)
                        )}
                        <span
                          className={clsx(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0b1118]',
                            target.is_online ? 'bg-emerald-400' : 'bg-slate-600',
                          )}
                          title={target.is_online ? 'Сейчас в сети' : 'Не в сети'}
                          aria-hidden
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: target.prefix?.color ?? '#E2E8F0' }}
                          >
                            {target.prefix && (
                              <>
                                <PrefixName prefix={target.prefix} />
                                {' · '}
                              </>
                            )}
                            {target.login}
                          </p>
                          {showsRole(target.prefix) && target.role === 'owner' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-400/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300">
                              <Crown className="h-2.5 w-2.5" aria-hidden />
                              Владелец
                            </span>
                          )}
                          {showsRole(target.prefix) &&
                            target.role_name &&
                            target.role !== 'owner' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                                {target.role_name}
                              </span>
                            )}
                          {isSelf && (
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                              это вы
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {renderReview(target)}
                          <span className="text-[10px] leading-relaxed text-slate-600">
                            {renderMeta(target)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                      <span
                        className={clsx(
                          'rounded-full border px-2.5 py-1 text-[10px] font-medium',
                          statusMeta.className,
                        )}
                      >
                        {statusMeta.label}
                      </span>

                      <div className="flex gap-1.5">
                        {target.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => void handleApprove(target)}
                            disabled={busy}
                            className="icon-btn h-8 w-8 hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                            title={`Одобрить доступ для «${target.login}»`}
                            aria-label={`Одобрить доступ для ${target.login}`}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}

                        {target.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => void handleReject(target)}
                            disabled={busy}
                            className="icon-btn h-8 w-8 hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-300"
                            title={`Отклонить заявку «${target.login}»`}
                            aria-label={`Отклонить заявку ${target.login}`}
                          >
                            <UserX className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}

                        {canDelete(target) && (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(target)}
                            disabled={busy}
                            className="icon-btn h-8 w-8 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                            title={`Удалить «${target.login}»`}
                            aria-label={`Удалить ${target.login}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}

                        {canManageRoles(target) && (
                          <button
                            type="button"
                            onClick={() => setAccessUser(target)}
                            disabled={busy}
                            className="icon-btn h-8 w-8 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
                            title={
                              target.id === currentUser?.id
                                ? 'Изменить свой префикс'
                                : `Роль и префикс «${target.login}»`
                            }
                            aria-label={
                              target.id === currentUser?.id
                                ? 'Изменить свой префикс'
                                : `Настроить роль и префикс ${target.login}`
                            }
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}

                        {canChangeRole(target) && (
                          <button
                            type="button"
                            onClick={() =>
                              setRoleChange({
                                user: target,
                                role: target.role === 'owner' ? 'admin' : 'owner',
                              })
                            }
                            disabled={busy}
                            className={clsx(
                              'icon-btn h-8 w-8',
                              target.role === 'owner'
                                ? 'hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200'
                                : 'hover:border-fuchsia-400/30 hover:bg-fuchsia-400/10 hover:text-fuchsia-300',
                            )}
                            title={
                              target.role === 'owner'
                                ? `Понизить «${target.login}» до администратора`
                                : `Выдать «${target.login}» полный доступ`
                            }
                            aria-label={
                              target.role === 'owner'
                                ? `Понизить ${target.login} до администратора`
                                : `Выдать полный доступ ${target.login}`
                            }
                          >
                            {target.role === 'owner' ? (
                              <UserMinus className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Crown className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
          </>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          Одобрять заявки может администратор с правом users.write, удалять аккаунты —
          с правом users.delete. Роли и префиксы выдаёт носитель права users.roles.
          Время в сети считается по активности в панели: онлайн — если заходил за последние
          10 минут, «всего в сети» — накопленное время за все сессии.
        </p>
      </main>

      <DeleteUserDialog
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onDeleted={handleDeleted}
      />

      <UserAccessDialog
        user={accessUser}
        selfMode={accessUser !== null && accessUser.id === currentUser?.id}
        onClose={() => setAccessUser(null)}
        onUpdated={handleAccessUpdated}
      />

      <ChangeRoleDialog
        user={roleChange?.user ?? null}
        role={roleChange?.role ?? null}
        onClose={() => setRoleChange(null)}
        onChanged={handleRoleChanged}
      />
    </div>
  );
}
