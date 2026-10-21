import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Coins,
  MessageSquareWarning,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { OnlineAdminsCard } from '../components/support/OnlineAdminsCard';
import { Spinner } from '../components/ui/Spinner';
import { ApiError, createReport } from '../lib/api';
import type { ReportInput, SupportTicket, TicketKind } from '../types';

const KIND_OPTIONS: Array<{ value: TicketKind; label: string; hint: string }> = [
  { value: 'price', label: 'Ошибка в цене', hint: 'Минималка не совпадает с игрой' },
  { value: 'item', label: 'Предмет', hint: 'Неверная иконка, название или категория' },
  { value: 'error', label: 'Ошибка сайта', hint: 'Что-то не работает или выглядит сломанным' },
  { value: 'other', label: 'Другое', hint: 'Всё, что не попало в другие пункты' },
];

const EMPTY_FORM: ReportInput = {
  kind: 'price',
  nick: '',
  discord: '',
  target: '',
  message: '',
};

export function ReportPage() {
  const [form, setForm] = useState<ReportInput>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Обращение — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  function updateField<K extends keyof ReportInput>(key: K, value: ReportInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);

    try {
      const created = await createReport({
        ...form,
        nick: form.nick.trim(),
        discord: form.discord.trim(),
        target: form.target.trim(),
        message: form.message.trim(),
      });
      setTicket(created);
      setForm(EMPTY_FORM);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось отправить обращение. Попробуйте позже',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/[0.04] pb-10 pt-12 sm:pt-14">
          <div className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-amber-400/[0.05] blur-[110px]"
            aria-hidden
          />
          <div className="container-page relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
              Обратная связь
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Сообщить о проблеме
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Заметили неверную цену, неподходящую иконку или ошибку на сайте? Опишите ситуацию —
              обращение попадёт в админ-панель, и администратор ответит вам в Discord.
            </p>
          </div>
        </section>

        <div className="container-page py-8 sm:py-10">
          {ticket ? (
            <div className="panel mx-auto flex max-w-2xl flex-col items-center px-6 py-12 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-white">Обращение принято</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Номер вашего обращения —{' '}
                <span className="font-mono text-accent">#{String(ticket.ticket_no).padStart(5, '0')}</span>.
                Сохраните его: по номеру администратор быстрее найдёт переписку.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setTicket(null)} className="btn btn-primary">
                  Отправить ещё одно
                </button>
                <a href="/" className="btn btn-secondary">
                  Вернуться в каталог
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <form onSubmit={handleSubmit} className="panel space-y-5 p-5 sm:p-6">
                <div>
                  <span className="field-label">Тип обращения</span>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {KIND_OPTIONS.map((option) => {
                      const active = form.kind === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateField('kind', option.value)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition ${
                            active
                              ? 'border-accent/40 bg-accent/[0.08]'
                              : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                          }`}
                          aria-pressed={active}
                        >
                          <span
                            className={`block text-sm font-medium ${active ? 'text-accent' : 'text-slate-200'}`}
                          >
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Игровой ник</span>
                    <input
                      required
                      value={form.nick}
                      onChange={(event) => updateField('nick', event.target.value)}
                      placeholder="Steve"
                      minLength={2}
                      maxLength={64}
                      className="field mt-1.5"
                      autoComplete="nickname"
                    />
                  </label>

                  <label className="block">
                    <span className="field-label">Discord</span>
                    <input
                      required
                      value={form.discord}
                      onChange={(event) => updateField('discord', event.target.value)}
                      placeholder="username или username#0000"
                      minLength={2}
                      maxLength={64}
                      className="field mt-1.5"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="field-label">
                    Предмет <span className="font-normal text-slate-600">(необязательно)</span>
                  </span>
                  <input
                    value={form.target}
                    onChange={(event) => updateField('target', event.target.value)}
                    placeholder="Например: «Инфинити сундук»"
                    maxLength={160}
                    className="field mt-1.5"
                  />
                </label>

                <label className="block">
                  <span className="field-label">Текст обращения</span>
                  <textarea
                    required
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="Опишите, что произошло. Для ошибки в цене укажите предмет и цену в игре."
                    minLength={10}
                    maxLength={4000}
                    rows={7}
                    className="field mt-1.5 resize-y"
                  />
                  <span className="mt-1 block text-right text-[10px] text-slate-600">
                    {form.message.length} / 4000
                  </span>
                </label>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2.5 text-xs text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Отправляя обращение, вы соглашаетесь на обработку указанных данных
                    для ответа на обращение.
                  </p>
                  <button type="submit" disabled={sending} className="btn btn-primary shrink-0">
                    {sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
                    {sending ? 'Отправляем…' : 'Отправить обращение'}
                  </button>
                </div>
              </form>

              <aside className="space-y-4">
                <OnlineAdminsCard />

                <div className="panel p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                    Что будет дальше
                  </h2>
                  <ol className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                    <li className="flex gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[10px] font-semibold text-accent">
                        1
                      </span>
                      Обращение появится в админ-панели в разделе «Обращения».
                    </li>
                    <li className="flex gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[10px] font-semibold text-accent">
                        2
                      </span>
                      Администратор проверит цену, предмет или ситуацию в игре.
                    </li>
                    <li className="flex gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[10px] font-semibold text-accent">
                        3
                      </span>
                      Ответ придёт в Discord, который вы указали.
                    </li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                    <MessageSquareWarning className="h-4 w-4" aria-hidden />
                    Важно
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-100/80">
                    Не отправляйте несколько одинаковых обращений: это замедляет проверку.
                    Для срочных вопросов пишите администраторам в игре.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <Coins className="h-4 w-4 text-accent" aria-hidden />
                    <p className="mt-2 text-[11px] text-slate-500">Ошибки в ценах</p>
                    <p className="text-xs font-medium text-slate-300">Проверяем по игре</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <Bug className="h-4 w-4 text-amber-300" aria-hidden />
                    <p className="mt-2 text-[11px] text-slate-500">Ошибки сайта</p>
                    <p className="text-xs font-medium text-slate-300">Передаём разработчику</p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
