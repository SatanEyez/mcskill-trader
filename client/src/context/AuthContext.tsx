import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AUTH_EXPIRED_EVENT,
  changePassword as changePasswordRequest,
  clearStoredToken,
  fetchMe,
  getStoredToken,
  login as loginRequest,
  setStoredToken,
} from '../lib/api';
import { clearCache } from '../lib/query-cache';
import type { AdminUser } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: AdminUser | null;
  /** Проверка права RBAC. Владелец проходит любую проверку. */
  can: (permission: string) => boolean;
  /** Перечитать профиль после смены роли/префикса. */
  refreshUser: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getStoredToken() ? 'loading' : 'anonymous',
  );
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let active = true;

    if (!getStoredToken()) {
      setStatus('anonymous');
      return;
    }

    fetchMe()
      .then((data) => {
        if (!active) return;
        setUser(data);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        clearStoredToken();
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      // Кэш мог содержать данные прошлой сессии — на выходе его выбрасываем.
      clearCache();
      setUser(null);
      setStatus('anonymous');
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    const data = await loginRequest(login, password);
    setStoredToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    clearCache();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await changePasswordRequest(currentPassword, newPassword);
    setStoredToken(data.token);
    setUser(data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) return;

    const data = await fetchMe();
    setUser(data);
    setStatus('authenticated');
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === 'owner' || user.permissions.includes('*')) return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, can, refreshUser, login, logout, changePassword }),
    [status, user, can, refreshUser, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }

  return context;
}
