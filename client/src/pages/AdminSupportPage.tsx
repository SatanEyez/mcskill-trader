import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ApiError,
  fetchTickets,
  fetchTicketStats,
  updateTicket,
} from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatDateTimeMsk, pluralize } from '../lib/format';
import type {
  SupportTicket,
  TicketCounts,
  TicketKind,
  TicketStatus,
} from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminAvatar } from '../components/admin/AdminAvatar';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Modal } from '../components/ui/Modal';
import { PageLoader, Spinner } from '../components/ui/Spinner';

const KIND_LABELS: Record<TicketKind, string> = {
  item: 'Предмет',
  price: 'Цена',
  error: 'Ошибка сайта',
  other: 'Другое',
};

const STATUS_META: Record<TicketStatus, { label: string; className: string }> = {
  new: {
    label: 'Новое',
    className: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300',
  },
  in_progress: {
    label: 'В работе',
    className: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300',
  },
  answered: {
    label: 'Отвечено',
    className: 'border-accent/25 bg-accent/[0.08] text-accent-300',
  },
  closed: {
    label: 'Закрыто',
    className: 'border-white/10 bg-white/[0.03] text-slate-400',
  },
};

const STATUS_FILTERS: Array<{ value: TicketStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'answered', label: 'Отвеченные' },
  { value: 'closed', label: 'Закрытые' },
];

const PAGE_SIZE = 20;

export function AdminSupportPage() {
  const { notify } = useToast();

  const [status, setStatus] = useState<TicketStatus | 'all'>('all');
  const [kind, setKind] = useState<TicketKind | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState<TicketStatus>('in_progress');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);

      try {
        const [list, stats] = await Promise.all([
          fetchTickets({ status, kind, search, limit: PAGE_SIZE, offset }),
          fetchTicketStats(),
        ]);
        setTickets(list.data);
        setTotal(list.meta.total);
        setCounts(stats);
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Не удалось загрузить обращения',
        );
      } finally {
        setLoading(false);
      }
    },
    [status, kind, search, offset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Обращения — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  function openTicket(ticket: SupportTicket) {
    setSelected(ticket);
    setReply(ticket.admin_reply ?? '');
    setNextStatus(ticket.status === 'new' ? 'in_progress' : ticket.status);
  }

  async function handleSave() {
    if (!selected) return;

    setSaving(true);

    try {
      const updated = await updateTicket(selected.id, {
        status: nextStatus,
        admin_reply: reply.trim(),
      });
      setSelected(null);
      notify(`Обращение #${String(updated.ticket_no).padStart(5, '0')} обновлено`, 'success');
      await load(true);
    } catch (requestError) {
      notify(
        requestError instanceof ApiError ? requestError.message : 'Не удалось сохранить ответ',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Поддержка
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Обращения</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Ошибки в предметах, ценах и работе сайта. Ответ пользователю приходит в Discord,
              указанный при отправке формы.
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

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Новые"
            value={counts?.new ?? 0}
            icon={<MessageSquareWarning className="h-4 w-4" aria-hidden />}
            tone="rose"
          />
          <StatCard
            label="В работе"
            value={counts?.in_progress ?? 0}
            icon={<Clock4 className="h-4 w-4" aria-hidden />}
            tone="amber"
          />
          <StatCard
            label="Отвечено"
            value={counts?.answered ?? 0}
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
            tone="emerald"
          />
          <StatCard
            label="Всего"
            value={counts?.total ?? 0}
            icon={<UserRound className="h-4 w-4" aria-hidden />}
            tone="cyan"
          />
        </div>

        <div className="panel mt-6 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Ник, Discord, предмет или текст обращения…"
                className="field py-2.5 pl-10 [&::-webkit-search-cancel-button]:hidden"
                aria-label="Поиск обращений"
              />
            </div>

            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as TicketKind | 'all');
                setOffset(0);
              }}
              className="field py-2.5 text-sm lg:w-48"
              aria-label="Тип обращения"
            >
              <option value="all">Все типы</option>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setStatus(item.value);
                  setOffset(0);
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                  status === item.value
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300',
                )}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-slate-500">
              {total} {pluralize(total, ['обращение', 'обращения', 'обращений'])}
            </span>
          </div>
        </div>

        {error && tickets.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {error}
            </span>
            <button type="button" onClick={() => void load()} className="btn btn-secondary px-3 py-1.5 text-xs">
              Повторить
            </button>
          </div>
        )}

        {error && !loading && tickets.length === 0 ? (
          <div className="panel mt-4 flex flex-col items-center px-6 py-14 text-center">
            <AlertTriangle className="h-7 w-7 text-rose-300" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-white">Не удалось загрузить обращения</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => void load()} className="btn btn-primary mt-5">
              Попробовать снова
            </button>
          </div>
        ) : loading && tickets.length === 0 ? (
          <PageLoader label="Загружаем обращения…" />
        ) : tickets.length === 0 ? (
          <div className="panel mt-4 flex flex-col items-center px-6 py-14 text-center">
            <MessageSquareWarning className="h-7 w-7 text-slate-500" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-white">Обращений нет</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Когда пользователь отправит форму на сайте, обращение появится здесь.
            </p>
          </div>
        ) : (
          <>
            <div className="panel mt-4 overflow-hidden">
              <ul className="divide-y divide-white/[0.04]">
                {tickets.map((ticket) => {
                  const statusMeta = STATUS_META[ticket.status];

                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => openTicket(ticket)}
                        className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500">
                              #{String(ticket.ticket_no).padStart(5, '0')}
                            </span>
                            <span
                              className={clsx(
                                'rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                                statusMeta.className,
                              )}
                            >
                              {statusMeta.label}
                            </span>
                            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[9px] text-slate-400">
                              {KIND_LABELS[ticket.kind]}
                            </span>
                            {ticket.admin_reply && (
                              <span className="inline-flex items-center gap-1 text-[9px] text-accent-300">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                                есть ответ
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-sm text-slate-200">
                            {ticket.message}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-slate-600">
                            {ticket.nick} · Discord {ticket.discord}
                            {ticket.target ? ` · ${ticket.target}` : ''} ·{' '}
                            {formatDateTimeMsk(ticket.created_at)}
                          </p>
                        </div>

                        <span className="shrink-0 text-[10px] text-slate-600">
                          Открыть →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Страница {currentPage} из {pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0 || loading}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={currentPage >= pages || loading}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `Обращение #${String(selected.ticket_no).padStart(5, '0')}`
            : 'Обращение'
        }
        description={
          selected
            ? `${KIND_LABELS[selected.kind]} · ${selected.nick} · Discord ${selected.discord}`
            : ''
        }
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost">
              Закрыть
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                {formatDateTimeMsk(selected.created_at)}
                {selected.target ? ` · ${selected.target}` : ''}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {selected.message}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Статус</span>
                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
                  className="field"
                >
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                  Контакт
                </p>
                <p className="mt-1 truncate text-xs text-slate-300">
                  {selected.nick} · {selected.discord}
                </p>
              </div>
            </div>

            <label className="block">
              <span className="field-label">Ответ администратора</span>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Что проверили, что изменили и что ответить пользователю…"
                maxLength={4000}
                rows={5}
                className="field resize-y"
              />
              <span className="mt-1 block text-right text-[10px] text-slate-600">
                {reply.length} / 4000
              </span>
            </label>

            {selected.replied_by_login && (
              <p className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <AdminAvatar
                  login={selected.replied_by_login}
                  avatarUrl={selected.replied_by_avatar_url}
                  size="xs"
                  initials={1}
                />
                <span>
                  Последний ответ: {selected.replied_by_login}
                  {selected.replied_at ? ` · ${formatDateTimeMsk(selected.replied_at)}` : ''}
                </span>
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'rose' | 'amber' | 'emerald' | 'cyan';
}) {
  const styles = {
    rose: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-300',
    amber: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
    emerald: 'border-accent/20 bg-accent/[0.08] text-accent',
    cyan: 'border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300',
  } as const;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className={clsx('grid h-8 w-8 place-items-center rounded-lg border', styles[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
