import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  FileJson,
  Image as ImageIcon,
  RefreshCw,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, fetchImportJobs, importPrices } from '../lib/api';
import { formatDateTimeMsk } from '../lib/format';
import type { ImportJob, ImportSummary } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminAvatar } from '../components/admin/AdminAvatar';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Spinner } from '../components/ui/Spinner';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export function AdminImportPage() {
  const [pricesFile, setPricesFile] = useState<File | null>(null);
  const [spriteFile, setSpriteFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const pricesInput = useRef<HTMLInputElement>(null);
  const spriteInput = useRef<HTMLInputElement>(null);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);

    try {
      setJobs(await fetchImportJobs());
    } catch (requestError) {
      setJobsError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось загрузить историю импортов',
      );
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Импорт прайса — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pricesFile || !spriteFile) {
      setError('Прикрепите JSON прайса и icons.png');
      return;
    }

    setRunning(true);
    setProgress(0);
    setError(null);
    setSummary(null);

    try {
      const result = await importPrices(pricesFile, spriteFile, setProgress);
      setSummary(result);
      setPricesFile(null);
      setSpriteFile(null);
      if (pricesInput.current) pricesInput.current.value = '';
      if (spriteInput.current) spriteInput.current.value = '';
      await loadJobs();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Импорт не удался',
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Массовый импорт
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Импорт прайса и иконок
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Загрузите JSON с предметами и спрайт icons.png. Сервер нарежет иконки 32×32,
              создаст категории по модам и обновит цены. Все операции журналируются от имени{' '}
              <span className="font-mono text-slate-300">synced_</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadJobs()}
            className="btn btn-secondary shrink-0"
            disabled={jobsLoading}
          >
            <RefreshCw className={clsx('h-4 w-4', jobsLoading && 'animate-spin')} aria-hidden />
            Обновить историю
          </button>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <form onSubmit={handleSubmit} className="panel p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label
                className={clsx(
                  'flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-4 py-7 text-center transition',
                  pricesFile
                    ? 'border-accent/40 bg-accent/[0.05]'
                    : 'border-white/15 bg-white/[0.02] hover:border-accent/30 hover:bg-white/[0.03]',
                )}
              >
                <FileJson
                  className={clsx('h-8 w-8', pricesFile ? 'text-accent' : 'text-slate-500')}
                  aria-hidden
                />
                <span className="mt-3 text-sm font-medium text-slate-200">
                  {pricesFile ? pricesFile.name : 'JSON прайса'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  {pricesFile ? formatBytes(pricesFile.size) : 'mcskill_oneblock_prices.json'}
                </span>
                <input
                  ref={pricesInput}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => setPricesFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <label
                className={clsx(
                  'flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-4 py-7 text-center transition',
                  spriteFile
                    ? 'border-accent/40 bg-accent/[0.05]'
                    : 'border-white/15 bg-white/[0.02] hover:border-accent/30 hover:bg-white/[0.03]',
                )}
              >
                <ImageIcon
                  className={clsx('h-8 w-8', spriteFile ? 'text-accent' : 'text-slate-500')}
                  aria-hidden
                />
                <span className="mt-3 text-sm font-medium text-slate-200">
                  {spriteFile ? spriteFile.name : 'Спрайт icons.png'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  {spriteFile ? formatBytes(spriteFile.size) : 'RGBA PNG, ячейки 32×32'}
                </span>
                <input
                  ref={spriteInput}
                  type="file"
                  accept="image/png,.png"
                  className="sr-only"
                  onChange={(event) => setSpriteFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11px] leading-relaxed text-slate-500">
              <p>
                <span className="text-slate-300">Как обновляются данные:</span> предметы ищутся по
                источнику (itemid + damage). Существующие позиции обновляются, новые добавляются.
                Массового удаления нет — демо-ресурсы и ручные записи сохраняются.
              </p>
              <p className="mt-1.5">
                Повторный импорт того же файла безопасен: цены, иконки и категории просто
                обновятся.
              </p>
            </div>

            {running && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4 text-accent" />
                    Загружаем и разбираем прайс…
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(4, progress)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-600">
                  После загрузки сервер режет 9 000+ иконок и пишет их в базу — не закрывайте
                  страницу.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={running || !pricesFile || !spriteFile}
              className="btn btn-primary mt-5 w-full"
            >
              {running ? <Spinner /> : <Upload className="h-4 w-4" aria-hidden />}
              {running ? 'Импортируем…' : 'Запустить импорт'}
            </button>
          </form>

          <aside className="space-y-4">
            {summary && (
              <div className="panel border-accent/20 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />
                  Импорт завершён
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Всего" value={summary.total} />
                  <Stat label="Создано" value={summary.created} tone="emerald" />
                  <Stat label="Обновлено" value={summary.updated} tone="cyan" />
                  <Stat label="Иконок" value={summary.images} />
                  <Stat label="Пропущено" value={summary.skipped} tone="amber" />
                  <Stat label="Ошибок" value={summary.errors.length} tone="rose" />
                </dl>
                <p className="mt-3 font-mono text-[9px] text-slate-600">
                  job {summary.job_id.slice(0, 8)} · автор synced_
                </p>
              </div>
            )}

            <div className="panel p-4">
              <p className="text-sm font-semibold text-white">Требования к файлам</p>
              <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-slate-400">
                <li>• JSON: объект с массивом items (как в mcskill_oneblock_prices.json).</li>
                <li>• PNG: RGBA 8 бит без интерлейса, ширина и высота кратны 32.</li>
                <li>• Иконки берутся по порядку предметов в JSON.</li>
                <li>• Максимальный размер каждого файла — 25 МБ.</li>
              </ul>
            </div>
          </aside>
        </div>

        <section className="mt-9">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Clock4 className="h-5 w-5 text-slate-400" aria-hidden />
            История импортов
          </h2>

          {jobsError ? (
            <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
              {jobsError}
            </p>
          ) : jobsLoading && jobs.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="h-4 w-4 text-accent" />
              Загружаем историю…
            </div>
          ) : jobs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Импортов ещё не было.</p>
          ) : (
            <div className="panel mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-4 py-3 font-semibold">Когда</th>
                    <th className="px-4 py-3 font-semibold">Автор</th>
                    <th className="px-4 py-3 font-semibold">Файл</th>
                    <th className="px-4 py-3 text-right font-semibold">Всего</th>
                    <th className="px-4 py-3 text-right font-semibold">Создано</th>
                    <th className="px-4 py-3 text-right font-semibold">Обновлено</th>
                    <th className="px-4 py-3 text-right font-semibold">Иконки</th>
                    <th className="px-4 py-3 font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {formatDateTimeMsk(job.started_at)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <AdminAvatar
                            login={job.actor_login}
                            avatarUrl={job.actor_avatar_url}
                            size="xs"
                            initials={1}
                          />
                          {job.actor_login}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-400" title={job.source_name ?? ''}>
                        {job.source_name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-300">
                        {job.total_items}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-accent-300">
                        {job.created_count}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-cyan-300">
                        {job.updated_count}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-300">
                        {job.image_count}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={clsx(
                            'inline-flex rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                            job.status === 'done'
                              ? 'border-accent/25 bg-accent/[0.08] text-accent-300'
                              : job.status === 'running'
                                ? 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300'
                                : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300',
                          )}
                        >
                          {job.status === 'done'
                            ? 'готово'
                            : job.status === 'running'
                              ? 'в процессе'
                              : `ошибка (${job.error_count})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-5 text-[11px] leading-relaxed text-slate-600">
          Импорт не удаляет ресурсы. Если нужно убрать позицию из каталога, сделайте это вручную
          в разделе «Ресурсы» — так действие попадёт в журнал под вашим аккаунтом.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'cyan' | 'amber' | 'rose';
}) {
  const colors = {
    slate: 'text-slate-200',
    emerald: 'text-accent-300',
    cyan: 'text-cyan-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  } as const;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <dt className="text-[9px] uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={clsx('mt-0.5 font-display text-base font-semibold', colors[tone])}>
        {value}
      </dd>
    </div>
  );
}
