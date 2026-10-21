import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  KeyRound,
  MessageSquareWarning,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Tags,
  Upload,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import {
  describeAuditDetails,
  getAuditActionMeta,
  shouldShowEntityLabel,
  type AuditTone,
} from '../lib/audit';
import { formatDateTimeMsk, pluralize } from '../lib/format';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type { AuditGroup, AuditPeriod } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminAvatar } from '../components/admin/AdminAvatar';
import { AdminTabs } from '../components/admin/AdminTabs';
import { PageLoader, Spinner } from '../components/ui/Spinner';

const TONE_CLASSES: Record<AuditTone, string> = {
  emerald: 'border-accent/20 bg-accent/[0.08] text-accent',
  cyan: 'border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300',
  amber: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
  rose: 'border-rose-500/20 bg-rose-500/[0.08] text-rose-300',
  fuchsia: 'border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300',
  slate: 'border-white/[0.07] bg-white/[0.03] text-slate-400',
};

const GROUP_ICONS: Record<AuditGroup, LucideIcon> = {
  resources: Boxes,
  categories: Tags,
  users: UsersRound,
  access: KeyRound,
  import: Upload,
  support: MessageSquareWarning,
  auth: ShieldCheck,
};

const GROUPS = [
  { value: 'all', label: 'Все действия' },
  { value: 'resources', label: 'Ресурсы' },
  { value: 'categories', label: 'Категории' },
  { value: 'users', label: 'Администраторы' },
  { value: 'access', label: 'Роли и префиксы' },
  { value: 'import', label: 'Импорт' },
  { value: 'support', label: 'Обращения' },
  { value: 'auth', label: 'Входы' },
] as const;

const PERIODS = [
  { value: '24h', label: 'За сутки' },
  { value: '7d', label: 'За 7 дней' },
  { value: '30d', label: 'За 30 дней' },
  { value: 'all', label: 'За всё время' },
] as const;

export function AdminLogsPage() {
  const [group, setGroup] = useState<AuditGroup | 'all'>('all');
  const [period, setPeriod] = useState<AuditPeriod>('7d');
  const [userId, setUserId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { users } = useAdminUsers('all');
  const { entries, total, loading, loadingMore, error, hasMore, reload, loadMore } = useAuditLogs({
    group,
    period,
    userId,
    search: debouncedSearch,
  });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Журнал действий — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const hasFilters = group !== 'all' || period !== '7d' || userId !== 'all' || search.trim() !== '';

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              История изменений
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Журнал действий</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Кто, что и когда сделал: добавление и удаление предметов, категории, управление
              доступами и входы в панель. Время указано по Москве.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void reload({ silent: true })}
            className="btn btn-secondary shrink-0"
            disabled={loading}
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            Обновить
          </button>
        </div>

        <div className="panel mt-7 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_200px]">
            <div className="relative">
              <ScrollText
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию предмета или логину…"
                className="field py-2.5 pl-10 text-sm [&::-webkit-search-cancel-button]:hidden"
                aria-label="Поиск по журналу"
              />
            </div>

            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as AuditGroup | 'all')}
              className="field py-2.5 text-sm"
              aria-label="Тип действий"
            >
              {GROUPS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as AuditPeriod)}
              className="field py-2.5 text-sm"
              aria-label="Период"
            >
              {PERIODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="field py-2.5 text-sm"
              aria-label="Администратор"
            >
              <option value="all">Все администраторы</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Показано {entries.length} из {total}{' '}
              {pluralize(total, ['записи', 'записей', 'записей'])}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setGroup('all');
                  setPeriod('7d');
                  setUserId('all');
                  setSearch('');
                }}
                className="text-accent transition hover:text-accent-300"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        <div className="panel mt-4 overflow-hidden">
          {error && entries.length > 0 && (
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

          {error && !loading && entries.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить журнал</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
              <button type="button" onClick={() => void reload()} className="btn btn-primary mt-5">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Попробовать снова
              </button>
            </div>
          ) : loading && entries.length === 0 ? (
            <PageLoader label="Загружаем журнал…" />
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <ScrollText className="h-6 w-6 text-slate-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">Записей нет</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                {hasFilters
                  ? 'За выбранный период и фильтры ничего не найдено.'
                  : 'Как только администраторы начнут менять каталог, записи появятся здесь.'}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setGroup('all');
                    setPeriod('all');
                    setUserId('all');
                    setSearch('');
                  }}
                  className="btn btn-secondary mt-5"
                >
                  Показать все действия
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-white/[0.04]">
                {entries.map((entry) => {
                  const meta = getAuditActionMeta(entry.action);
                  const Icon = GROUP_ICONS[meta.group];
                  const details = describeAuditDetails(entry.action, entry.details);
                  const entityName = entry.entity_label;

                  return (
                    <li key={entry.id} className="flex gap-3 px-4 py-3.5 transition hover:bg-white/[0.02]">
                      <span
                        className={clsx(
                          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                          TONE_CLASSES[meta.tone],
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-slate-300">
                          <span className="inline-flex items-center gap-1.5 align-middle">
                            <AdminAvatar
                              login={entry.user_login}
                              avatarUrl={entry.user_avatar_url}
                              size="xs"
                              initials={1}
                            />
                            <span className="font-semibold text-white">{entry.user_login}</span>
                          </span>{' '}
                          {meta.label}
                          {shouldShowEntityLabel(entry.action, entityName, entry.user_login) && (
                            <> «<span className="text-slate-100">{entityName}</span>»</>
                          )}
                        </p>

                        {details.length > 0 && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                            {details.map((item) => (
                              <span
                                key={item}
                                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5"
                              >
                                {item}
                              </span>
                            ))}
                          </p>
                        )}

                        <p className="mt-1 font-mono text-[10px] text-slate-600">
                          {formatDateTimeMsk(entry.created_at)}
                          {entry.ip ? ` · ${entry.ip}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {hasMore && (
                <div className="border-t border-white/[0.05] p-4">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="btn btn-secondary w-full"
                    disabled={loadingMore}
                  >
                    {loadingMore ? <Spinner /> : <ScrollText className="h-4 w-4" aria-hidden />}
                    {loadingMore ? 'Загружаем…' : 'Показать ещё'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          Журнал ведётся на сервере: в него попадают изменения каталога, управление доступами и
          попытки входа. Удаление администратора не удаляет его историю действий.
        </p>
      </main>
    </div>
  );
}
