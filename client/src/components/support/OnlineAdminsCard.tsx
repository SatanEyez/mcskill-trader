import clsx from 'clsx';
import { useOnlineAdmins } from '../../hooks/useOnlineAdmins';
import { pluralize } from '../../lib/format';
import { AdminAvatar } from '../admin/AdminAvatar';

/**
 * Компактный блок присутствия для страницы обращений: сколько администраторов
 * сейчас в сети. Источник — `admin_users.last_seen_at`, окно 10 минут
 * (см. `useOnlineAdmins`), обновление раз в 30 секунд.
 *
 * Ошибку сети намеренно показываем мягко: страница нужна человеку, чтобы
 * пожаловаться на проблему, красная плашка «не удалось загрузить» тут только
 * мешает. В любом случае обращение уходит в админ-панель.
 */
export function OnlineAdminsCard() {
  const { admins, loading, error } = useOnlineAdmins();

  const count = admins.length;
  const unknown = loading || error !== null;
  const online = !unknown && count > 0;
  const visible = admins.slice(0, 4);

  const subtitle = loading
    ? 'Проверяем присутствие…'
    : error
      ? 'Не удалось проверить — ответ всё равно придёт в Discord'
      : count === 0
        ? 'Сейчас никого нет — обращение не потеряется'
        : `${count} ${pluralize(count, ['администратор', 'администратора', 'администраторов'])} онлайн`;

  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span
            className={clsx(
              'absolute inline-flex h-full w-full rounded-full bg-emerald-400/60',
              online && 'animate-ping',
            )}
          />
          <span
            className={clsx(
              'relative inline-flex h-2 w-2 rounded-full',
              online ? 'bg-emerald-400' : 'bg-slate-600',
            )}
          />
        </span>

        <p className="text-xs font-semibold text-emerald-200">Админы в сети</p>

        <span
          className="ml-auto font-display text-xl font-semibold tabular-nums text-white"
          aria-label={unknown ? 'Количество неизвестно' : `В сети: ${count}`}
        >
          {unknown ? '—' : count}
        </span>
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/70">{subtitle}</p>

      {visible.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          {visible.map((admin) => (
            <span
              key={admin.id}
              title={`${admin.prefix ? `${admin.prefix.name} · ` : ''}${admin.login}${
                admin.role_name ? ` — ${admin.role_name}` : ''
              }`}
            >
              <AdminAvatar
                login={admin.login}
                avatarUrl={admin.avatar_url}
                color={admin.prefix?.color ?? '#34D399'}
                size="sm"
              />
            </span>
          ))}

          {count > visible.length && (
            <span className="text-[10px] font-medium text-emerald-100/60">
              +{count - visible.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
