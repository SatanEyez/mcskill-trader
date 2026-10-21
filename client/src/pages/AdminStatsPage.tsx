import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Eye,
  Radio,
  RefreshCw,
  Repeat,
  UserPlus,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, fetchVisitors } from '../lib/api';
import { formatDateMsk, formatDateTimeMsk, pluralize } from '../lib/format';
import { useVisitStats } from '../hooks/useVisitStats';
import type { VisitPeriod, VisitorEntry } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { PageLoader } from '../components/ui/Spinner';

const PERIODS: Array<{ value: VisitPeriod; label: string }> = [
  { value: '24h', label: 'Сутки' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
];

const VISITORS_LIMIT = 50;

const numberFormatter = new Intl.NumberFormat('ru-RU');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** `2026-10-21 15:00` → `15:00`, `2026-10-21` → `21.10`. */
function bucketLabel(bucket: string): string {
  if (bucket.includes(' ')) return bucket.slice(-5);

  const parts = bucket.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : bucket;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(value)}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

export function AdminStatsPage() {
  const [period, setPeriod] = useState<VisitPeriod>('7d');
  const { stats, loading, error, reload } = useVisitStats(period);

  const [visitors, setVisitors] = useState<VisitorEntry[]>([]);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);
  const [visitorsLoading, setVisitorsLoading] = useState(true);

  const loadVisitors = useCallback(async () => {
    setVisitorsLoading(true);

    try {
      const response = await fetchVisitors({ limit: VISITORS_LIMIT });
      setVisitors(response.data);
      setVisitorsError(null);
    } catch (loadError) {
      setVisitorsError(
        loadError instanceof ApiError ? loadError.message : 'Не удалось загрузить посетителей',
      );
    } finally {
      setVisitorsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const refreshAll = () => {
    void reload();
    void loadVisitors();
  };

  const series = stats?.series ?? [];
  const maxVisits = Math.max(1, ...series.map((point) => point.visits));
  const maxPageVisits = Math.max(1, ...(stats?.pages ?? []).map((page) => page.visits));

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Аналитика
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white sm:text-3xl">
              <BarChart3 className="h-6 w-6 text-accent" aria-hidden />
              Статистика посещений
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Уникальные посетители считаются по долгоживущей cookie, поэтому один и тот же человек
              не превращается в нескольких. Боты, краулеры и мониторы в статистику не попадают.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            className="btn btn-secondary shrink-0"
            disabled={loading}
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            Обновить
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={clsx(
                'rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition',
                period === item.value
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-200/90">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {error}
            </span>
            <button type="button" onClick={() => void reload()} className="btn btn-secondary px-3 py-1.5 text-xs">
              Повторить
            </button>
          </div>
        )}

        {loading && !stats ? (
          <PageLoader label="Считаем посещения…" />
        ) : !stats ? (
          <div className="panel mt-6 flex flex-col items-center px-6 py-14 text-center">
            <BarChart3 className="h-7 w-7 text-slate-500" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-white">Статистики пока нет</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Данные появятся после первых просмотров сайта.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Просмотры" value={stats.visits} hint="за период" />
              <StatCard label="Уникальные" value={stats.visitors} hint="разных людей" />
              <StatCard label="Новые" value={stats.new_visitors} hint="зашли впервые" />
              <StatCard label="Вернувшиеся" value={stats.returning_visitors} hint="уже были раньше" />
              <StatCard label="Онлайн" value={stats.online_now} hint="за последние 5 минут" />
            </div>

            <div className="panel mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-accent" aria-hidden />
                Всего за всё время: <span className="text-slate-300">{formatNumber(stats.total_visitors)}</span>{' '}
                {pluralize(stats.total_visitors, ['посетитель', 'посетителя', 'посетителей'])}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-accent" aria-hidden />
                {formatNumber(stats.total_visits)} просмотров
              </span>
              {stats.last_visit_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-accent" aria-hidden />
                  Последний визит: {formatDateTimeMsk(stats.last_visit_at)}
                </span>
              )}
              {stats.first_visit_at && (
                <span>Первый визит: {formatDateMsk(stats.first_visit_at)}</span>
              )}
            </div>

            <section className="panel mt-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">
                  {period === '24h' ? 'Посещения по часам' : 'Посещения по дням'}
                </h2>
                <span className="text-[10px] text-slate-600">по МСК</span>
              </div>

              {series.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  За этот период посещений не было.
                </p>
              ) : (
                <div className="mt-5">
                  <div className="flex h-40 items-end gap-1 sm:gap-1.5">
                    {series.map((point) => (
                      <div
                        key={point.bucket}
                        className="group flex h-full flex-1 items-end"
                        title={`${bucketLabel(point.bucket)} — ${point.visits} просмотров, ${point.visitors} посетителей`}
                      >
                        <div
                          className="w-full rounded-t bg-accent/40 transition group-hover:bg-accent/70"
                          style={{ height: `${Math.max(3, Math.round((point.visits / maxVisits) * 100))}%` }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex gap-1 sm:gap-1.5" aria-hidden>
                    {series.map((point, index) => (
                      <span
                        key={point.bucket}
                        className="flex-1 text-center text-[9px] text-slate-600"
                      >
                        {series.length <= 14 || index % Math.ceil(series.length / 12) === 0
                          ? bucketLabel(point.bucket)
                          : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <section className="panel p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-white">Популярные страницы</h2>

                {stats.pages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">Пока нет данных.</p>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {stats.pages.map((page) => (
                      <li key={page.path}>
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="truncate font-mono text-slate-300">{page.path}</span>
                          <span className="shrink-0 text-slate-500">{formatNumber(page.visits)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                          <div
                            className="h-full rounded-full bg-accent/50"
                            style={{ width: `${Math.max(2, Math.round((page.visits / maxPageVisits) * 100))}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Посетители</h2>
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                    <UserPlus className="h-3 w-3" aria-hidden />
                    {formatNumber(stats.total_visitors)} всего
                  </span>
                </div>

                {visitorsError && (
                  <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2 text-[11px] text-rose-300">
                    {visitorsError}
                  </p>
                )}

                {visitorsLoading && visitors.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">Загружаем…</p>
                ) : visitors.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Ещё никто не заходил.
                  </p>
                ) : (
                  <div className="mt-3 -mx-1 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[11px]">
                      <thead className="text-[9px] uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="px-1 py-1.5 font-medium">Посетитель</th>
                          <th className="px-1 py-1.5 font-medium">Первый</th>
                          <th className="px-1 py-1.5 font-medium">Последний</th>
                          <th className="px-1 py-1.5 text-right font-medium">Визитов</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {visitors.map((visitor) => (
                          <tr key={visitor.id} className="text-slate-400">
                            <td className="max-w-[140px] px-1 py-1.5">
                              <span className="font-mono text-slate-300">
                                #{visitor.id.slice(0, 8)}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-600">
                                {visitor.last_path}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5">
                              {formatDateMsk(visitor.first_seen)}
                            </td>
                            <td className="whitespace-nowrap px-1 py-1.5">
                              {formatDateTimeMsk(visitor.last_seen)}
                            </td>
                            <td className="px-1 py-1.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="h-3 w-3 text-slate-600" aria-hidden />
                                {visitor.visits}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
