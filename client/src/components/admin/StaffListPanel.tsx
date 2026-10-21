import {
  Activity,
  Clock4,
  Crown,
  RefreshCw,
  SlidersHorizontal,
  Timer,
  Trash2,
  UserMinus,
  UsersRound,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateTimeMsk, formatDuration, pluralize } from '../../lib/format';
import type { AdminRole, AdminStaffMeta, AdminUser } from '../../types';

interface StaffListPanelProps {
  staff: AdminUser[];
  meta: AdminStaffMeta;
  pendingCount: number;
  loading: boolean;
  error: string | null;
  currentUserId: string | undefined;
  can: (permission: string) => boolean;
  busyId: string | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
  onShowPending: () => void;
  onAccess: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onRoleChange: (user: AdminUser, role: AdminRole) => void;
}

/** Сколько всего человек провёл в панели: накопленное + текущая сессия. */
function totalOnlineSeconds(user: AdminUser): number {
  const base = user.online_seconds ?? 0;

  if (!user.is_online || !user.session_started_at) return base;

  const started = new Date(user.session_started_at).getTime();
  const extra = Number.isFinite(started)
    ? Math.max(0, Math.floor((Date.now() - started) / 1000))
    : 0;

  return base + extra;
}

/** Сессия «в сети»: аватар с индикатором присутствия. */
function StaffAvatar({ user }: { user: AdminUser }) {
  return (
    <span
      className={clsx(
        'relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border text-sm font-semibold uppercase',
        user.role === 'owner'
          ? 'border-fuchsia-400/25 bg-fuchsia-400/[0.08] text-fuchsia-300'
          : 'border-accent/20 bg-accent/[0.08] text-accent',
      )}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" aria-hidden />
      ) : (
        user.login.slice(0, 1)
      )}
      <span
        className={clsx(
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0b1118]',
          user.is_online ? 'bg-emerald-400' : 'bg-slate-600',
        )}
        title={user.is_online ? 'Сейчас в сети' : 'Не в сети'}
        aria-hidden
      />
    </span>
  );
}

/**
 * Полный список администрации: кто имеет доступ, роль, права,
 * присутствие и накопленное время в сети.
 */
export function StaffListPanel({
  staff,
  meta,
  pendingCount,
  loading,
  error,
  currentUserId,
  can,
  busyId,
  reload,
  onShowPending,
  onAccess,
  onDelete,
  onRoleChange,
}: StaffListPanelProps) {
  const canDelete = (target: AdminUser): boolean =>
    can('users.delete') && target.role !== 'owner' && !target.is_system && target.id !== currentUserId;

  const canManageRoles = (target: AdminUser): boolean =>
    can('users.roles') && !target.is_system;

  /** Свою роль менять нельзя — только префикс. */
  const canChangeRole = (target: AdminUser): boolean =>
    canManageRoles(target) && target.id !== currentUserId;

  return (
    <>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Администрация
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
              <UsersRound className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-white">
            {loading ? '—' : meta.total}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500">аккаунтов с доступом</p>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Онлайн сейчас
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <Activity className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-white">
            {loading ? '—' : meta.online}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500">в панели за 10 минут</p>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              В сети всего
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/20 bg-accent/[0.08] text-accent">
              <Timer className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 font-display text-xl font-semibold text-white">
            {loading ? '—' : formatDuration(meta.total_online_seconds)}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500">суммарно у всех</p>
        </div>

        <button
          type="button"
          onClick={onShowPending}
          className="panel p-4 text-left transition hover:border-amber-400/25 hover:bg-amber-400/[0.03]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Заявки
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
              <Clock4 className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-white">{pendingCount}</p>
          <p className="mt-1 truncate text-[11px] text-slate-500">ожидают решения</p>
        </button>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            Полный список администрации
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {meta.total} {pluralize(meta.total, ['человек', 'человека', 'человек'])}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void reload({ silent: true })}
            className="btn btn-secondary px-3 py-1.5 text-xs"
            disabled={loading}
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Обновить
          </button>
        </div>

        {error && staff.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-rose-300">{error}</p>
        ) : loading && staff.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Загружаем администрацию…</p>
        ) : staff.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Пока ни у кого нет доступа. Одобрите заявку во вкладке «Аккаунты».
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {staff.map((member) => {
              const busy = busyId === member.id;
              const isSelf = member.id === currentUserId;
              const permissionsLabel =
                member.role === 'owner'
                  ? 'все права (владелец)'
                  : `${member.permissions.length} ${pluralize(member.permissions.length, ['право', 'права', 'прав'])}`;

              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <StaffAvatar user={member} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: member.prefix?.color ?? '#E2E8F0' }}
                        >
                          {member.prefix ? `${member.prefix.name} · ` : ''}
                          {member.login}
                        </p>

                        {member.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-400/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300">
                            <Crown className="h-2.5 w-2.5" aria-hidden />
                            Владелец
                          </span>
                        ) : (
                          member.role_name && (
                            <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                              {member.role_name}
                            </span>
                          )
                        )}

                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium',
                            member.is_online
                              ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
                              : 'border-white/[0.07] bg-white/[0.02] text-slate-500',
                          )}
                        >
                          <span
                            className={clsx(
                              'h-1.5 w-1.5 rounded-full',
                              member.is_online ? 'bg-emerald-400' : 'bg-slate-600',
                            )}
                            aria-hidden
                          />
                          {member.is_online ? 'в сети' : 'оффлайн'}
                        </span>

                        {isSelf && (
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                            это вы
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-relaxed text-slate-500">
                        <span>
                          {member.is_online
                            ? 'заходил(а) только что'
                            : member.last_seen_at
                              ? `был(а) в сети ${formatDateTimeMsk(member.last_seen_at)}`
                              : 'ещё не заходил(а)'}
                        </span>
                        <span className="text-slate-700">·</span>
                        <span>
                          {member.last_login_at
                            ? `вход ${formatDateTimeMsk(member.last_login_at)}`
                            : 'входов не было'}
                        </span>
                        <span className="text-slate-700">·</span>
                        <span title={member.permissions.join(', ')}>{permissionsLabel}</span>
                      </div>

                      <p className="mt-1 text-[10px] text-slate-600">
                        Всего в сети:{' '}
                        <span className="font-medium text-slate-400">
                          {formatDuration(totalOnlineSeconds(member))}
                        </span>
                        {member.is_online && member.session_started_at && (
                          <> · текущая сессия с {formatDateTimeMsk(member.session_started_at)}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-1.5">
                    {canManageRoles(member) && (
                      <button
                        type="button"
                        onClick={() => onAccess(member)}
                        disabled={busy}
                        className="icon-btn h-8 w-8 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
                        title={
                          member.id === currentUserId
                            ? 'Изменить свой префикс'
                            : `Роль и префикс «${member.login}»`
                        }
                        aria-label={
                          member.id === currentUserId
                            ? 'Изменить свой префикс'
                            : `Настроить роль и префикс ${member.login}`
                        }
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}

                    {canChangeRole(member) && (
                      <button
                        type="button"
                        onClick={() =>
                          onRoleChange(member, member.role === 'owner' ? 'admin' : 'owner')
                        }
                        disabled={busy}
                        className={clsx(
                          'icon-btn h-8 w-8',
                          member.role === 'owner'
                            ? 'hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200'
                            : 'hover:border-fuchsia-400/30 hover:bg-fuchsia-400/10 hover:text-fuchsia-300',
                        )}
                        title={
                          member.role === 'owner'
                            ? `Понизить «${member.login}» до администратора`
                            : `Выдать «${member.login}» полный доступ`
                        }
                        aria-label={
                          member.role === 'owner'
                            ? `Понизить ${member.login} до администратора`
                            : `Выдать полный доступ ${member.login}`
                        }
                      >
                        {member.role === 'owner' ? (
                          <UserMinus className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Crown className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    )}

                    {canDelete(member) && (
                      <button
                        type="button"
                        onClick={() => onDelete(member)}
                        disabled={busy}
                        className="icon-btn h-8 w-8 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                        title={`Удалить «${member.login}»`}
                        aria-label={`Удалить ${member.login}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
