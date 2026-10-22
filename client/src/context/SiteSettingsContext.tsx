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
import type { SiteSettings } from '../types';

const STORAGE_KEY = 'mcskill.site.halloween';

const DEFAULT_SETTINGS: SiteSettings = {
  halloween_enabled: false,
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  error: string | null;
  /** Включён ли сезонный режим — удобный флаг для компонентов. */
  halloween: boolean;
  updateSettings: (patch: Partial<SiteSettings>) => Promise<SiteSettings>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

function readStoredHalloween(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // Приватный режим может запрещать localStorage.
  }

  return null;
}

function storeHalloween(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

/**
 * Глобальные настройки оформления.
 *
 * Последнее известное значение храним в localStorage, чтобы сезонный режим
 * не мигал при перезагрузке. Источник истины — API, после ответа состояние
 * синхронизируется. Класс `halloween` на <html> включает CSS-тему и декор.
 */
export function SiteSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<SiteSettings>(() => ({
    halloween_enabled: readStoredHalloween() ?? DEFAULT_SETTINGS.halloween_enabled,
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('halloween', settings.halloween_enabled);
  }, [settings.halloween_enabled]);

  useEffect(() => {
    let active = true;

    fetchSiteSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        storeHalloween(data.halloween_enabled);
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
    const data = await saveSiteSettings(patch);
    setSettings(data);
    storeHalloween(data.halloween_enabled);
    setError(null);
    return data;
  }, []);

  const value = useMemo<SiteSettingsContextValue>(
    () => ({
      settings,
      loading,
      error,
      halloween: settings.halloween_enabled,
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
