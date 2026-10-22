import { useEffect, useState } from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Checkbox } from '../components/ui/Checkbox';
import { PageLoader } from '../components/ui/Spinner';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useToast } from '../context/ToastContext';

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

  async function handleToggleHalloween(enabled: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      await updateSettings({ halloween_enabled: enabled });
      notify(
        enabled ? 'Хэллоуин-оформление включено' : 'Хэллоуин-оформление выключено',
        'success',
      );
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
          <div className="grid gap-4 md:grid-cols-2">
            <section className="panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" aria-hidden />
                <h2 className="text-sm font-semibold text-white">Сезонное оформление</h2>
              </div>
              <p className="mb-4 text-xs text-slate-400">
                Включите Хэллоуин-режим: паутина в углах, тыквы, летучие мыши и призраки на
                всех страницах сайта. Изменение применяется сразу.
              </p>

              <Checkbox
                checked={settings.halloween_enabled}
                onChange={() => handleToggleHalloween(!settings.halloween_enabled)}
                label={
                  settings.halloween_enabled
                    ? 'Хэллоуин-оформление включено'
                    : 'Хэллоуин-оформление выключено'
                }
                className="mt-1"
              />

              {saving && (
                <p className="mt-2 text-[11px] text-slate-500">Сохраняем…</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
