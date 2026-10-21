import { ShieldCheck, UsersRound } from 'lucide-react';
import { useOnlineAdmins } from '../../hooks/useOnlineAdmins';
import { pluralize } from '../../lib/format';
import { Spinner } from '../ui/Spinner';
import { AdminAvatar } from '../admin/AdminAvatar';

/**
 * Правая колонка главной: кто из администраторов сейчас в сети.
 * Данные берутся из admin_users.last_seen_at (окно 10 минут).
 */
export function OnlineAdmins() {
  const { admins, loading, error } = useOnlineAdmins();

  return (
    <aside className="panel flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            В сети администраторы
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? 'Проверяем присутствие…'
              : `${admins.length} ${pluralize(admins.length, ['администратор', 'администратора', 'администраторов'])} онлайн`}
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <UsersRound className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 flex-1">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner className="h-5 w-5 text-accent" />
            Загружаем список
          </div>
        ) : error ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        ) : admins.length === 0 ? (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-5 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">Сейчас никого нет в сети</p>
            <p className="mt-1 text-xs text-slate-500">
              Администраторы появятся здесь, как только зайдут в панель.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {admins.map((admin) => {
              const color = admin.prefix?.color ?? '#34D399';

              return (
                <li
                  key={admin.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2.5"
                >
                  <AdminAvatar
                    login={admin.login}
                    avatarUrl={admin.avatar_url}
                    color={color}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-semibold"
                      style={{ color }}
                      title={admin.login}
                    >
                      {admin.prefix ? `${admin.prefix.name} · ` : ''}
                      {admin.login}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {admin.role_name ?? 'Администратор'}
                    </span>
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="Онлайн" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
