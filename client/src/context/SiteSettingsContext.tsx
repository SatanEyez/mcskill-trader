import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { fetchSiteSettings, updateSiteSettings as saveSiteSettings } from '../lib/api';
import { readStoredTheme, storeTheme } from '../lib/theme';
import type { SiteSettings, SiteTheme } from '../types';

const DEFAULT_THEME: SiteTheme = 'default';

const DEFAULT_SETTINGS: SiteSettings = {
  theme: DEFAULT_THEME,
  halloween_enabled: false,
  new_year_enabled: false,
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  error: string | null;
  /** Активная тема — основной флаг для декора и префиксов. */
  theme: SiteTheme;
  /** Совместимость с местами, где проверялся только хэллоуин. */
  halloween: boolean;
  newYear: boolean;
  updateSettings: (patch: Partial<SiteSettings>) => Promise<SiteSettings>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

/**
 * Приводит ответ API к полному набору полей.
 *
 * Старый сервер отдаёт только `halloween_enabled` — на этот случай выводим
 * тему из флага, чтобы клиент и сервер можно было обновлять по отдельности.
 */
function normalizeSettings(data: Partial<SiteSettings> | null | undefined): SiteSettings {
  const theme: SiteTheme =
    data?.theme ??
    (data?.new_year_enabled ? 'newyear' : data?.halloween_enabled ? 'halloween' : DEFAULT_THEME);

  return {
    theme,
    halloween_enabled: theme === 'halloween',
    new_year_enabled: theme === 'newyear',
  };
}

/**
 * Глобальные настройки оформления.
 *
 * Последнюю известную тему храним в localStorage, чтобы сезонное оформление
 * не мигало при перезагрузке. Источник истины — API, после ответа состояние
 * синхронизируется. Классы `halloween` / `newyear` на <html> включают CSS-тему
 * и декор, `data-theme` — общий признак для новых стилей.
 */
export function SiteSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const stored = readStoredTheme();

    return stored ? normalizeSettings({ theme: stored }) : DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('halloween', settings.theme === 'halloween');
    root.classList.toggle('newyear', settings.theme === 'newyear');
    root.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    let active = true;

    fetchSiteSettings()
      .then((data) => {
        if (!active) return;
        const normalized = normalizeSettings(data);
        setSettings(normalized);
        storeTheme(normalized.theme);
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить настройки');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<SiteSettings>) => {
    const data = normalizeSettings(await saveSiteSettings(patch));
    setSettings(data);
    storeTheme(data.theme);
    setError(null);
    return data;
  }, []);

  const value = useMemo<SiteSettingsContextValue>(
    () => ({
      settings,
      loading,
      error,
      theme: settings.theme,
      halloween: settings.theme === 'halloween',
      newYear: settings.theme === 'newyear',
      updateSettings,
    }),
    [settings, loading, error, updateSettings],
  );

  return (
    <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettingsContextValue {
  const context = useContext(SiteSettingsContext);

  if (!context) {
    throw new Error('useSiteSettings должен использоваться внутри SiteSettingsProvider');
  }

  return context;
}
