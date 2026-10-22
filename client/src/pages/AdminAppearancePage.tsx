import { useEffect, useState, type ComponentType } from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { PageLoader } from '../components/ui/Spinner';
import { PumpkinIcon } from '../components/halloween/HalloweenIcons';
import { SnowflakeIcon, TreeIcon } from '../components/newyear/NewYearIcons';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useToast } from '../context/ToastContext';
import type { SiteTheme } from '../types';

interface ThemeOption {
  value: SiteTheme;
  title: string;
  hint: string;
  /** Градиент мини-превью. */
  preview: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'default',
    title: 'Обычное',
    hint: 'Тёмная тема сайта без сезонных эффектов',
    preview: 'from-emerald-400/25 via-emerald-500/[0.08] to-transparent',
    icon: Sparkles,
    iconClass: 'text-emerald-300',
  },
  {
    value: 'halloween',
    title: 'Хэллоуин',
    hint: 'Тыквы, паутина, летучие мыши и оранжевые префиксы',
    preview: 'from-orange-400/30 via-purple-500/[0.12] to-transparent',
    icon: PumpkinIcon,
    iconClass: 'text-orange-200',
  },
  {
    value: 'newyear',
    title: 'Новый год',
    hint: 'Снег, гирлянда, ёлки и ледяные префиксы',
    preview: 'from-sky-300/30 via-emerald-400/[0.12] to-transparent',
    icon: TreeIcon,
    iconClass: 'text-sky-100',
  },
];

export function AdminAppearancePage() {
  const { settings, loading, updateSettings } = useSiteSettings();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Оформление — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function handleSelect(theme: SiteTheme) {
    if (saving || theme === settings.theme) return;

    setSaving(true);
    try {
      await updateSettings({ theme });
      const option = THEME_OPTIONS.find((item) => item.value === theme);
      notify(`Оформление: ${option?.title ?? theme}`, 'success');
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : 'Не удалось сохранить настройки',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080c12]">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page pb-16 pt-6">
        <div className="mb-6 flex items-center gap-2.5">
          <Palette className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-bold text-white">Оформление сайта</h1>
        </div>

        {loading ? (
          <PageLoader label="Загружаем настройки…" />
        ) : (
          <div className="space-y-4">
            <section className="panel p-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" aria-hidden />
                <h2 className="text-sm font-semibold text-white">Тема оформления</h2>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-slate-400">
                Активна одна тема. Она перекрашивает интерфейс, включает фоновый декор и
                автоматически меняет оформление префиксов администраторов — отдельно их
                настраивать не нужно. Изменение применяется сразу, перезагрузка не нужна.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {THEME_OPTIONS.map((option) => {
                  const active = settings.theme === option.value;
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void handleSelect(option.value)}
                      disabled={saving}
                      aria-pressed={active}
                      className={clsx(
                        'group relative flex flex-col overflow-hidden rounded-2xl border p-2.5 text-left transition',
                        active
                          ? 'border-accent/45 bg-accent/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.14)]'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]',
                        saving && 'cursor-wait opacity-80',
                      )}
                    >
                      <span
                        className={clsx(
                          'relative grid h-24 w-full place-items-center overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br',
                          option.preview,
                        )}
                        aria-hidden
                      >
                        <span className="absolute inset-0 bg-grid opacity-30" />
                        <Icon className={clsx('relative h-11 w-11 drop-shadow-lg', option.iconClass)} />
                        {option.value === 'newyear' && (
                          <>
                            <SnowflakeIcon className="absolute left-3 top-3 h-5 w-5 text-sky-100/70" />
                            <SnowflakeIcon className="absolute bottom-3 right-4 h-3.5 w-3.5 text-sky-100/50" />
                          </>
                        )}
                        {option.value === 'halloween' && (
                          <span className="absolute right-4 top-3 h-2 w-2 rounded-full bg-orange-200/70 shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
                        )}
                      </span>

                      <span className="mt-2.5 flex items-center gap-1.5 px-0.5">
                        <span className="text-[13px] font-semibold text-white">{option.title}</span>
                        {active && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                            <Check className="h-2.5 w-2.5" aria-hidden />
                            Включено
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block px-0.5 text-[11px] leading-relaxed text-slate-500">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {saving && <p className="mt-3 text-[11px] text-slate-500">Сохраняем…</p>}
            </section>

            <section className="panel p-4">
              <h2 className="text-sm font-semibold text-white">Как это работает</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                <li>
                  • Тема хранится в базе (`site_settings.theme`) и применяется у всех посетителей
                  сразу после сохранения.
                </li>
                <li>
                  • Префиксы администраторов подмешивают цвет темы: на Хэллоуине — тыквенный
                  оранжевый, в Новый год — ледяной голубой. «Shiny»-блеск и искры тоже меняют
                  оттенок.
                </li>
                <li>
                  • Сезонный декор — отдельный слой под контентом: он не перекрывает кнопки,
                  формы и таблицы, отключён от скринридеров и уважает
                  <span className="text-slate-300"> prefers-reduced-motion</span>.
                </li>
                <li>
                  • Выключить сезонное оформление можно в любой момент — выберите «Обычное».
                </li>
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
