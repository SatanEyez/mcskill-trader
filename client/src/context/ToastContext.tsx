import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import clsx from 'clsx';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const STYLES: Record<ToastKind, string> = {
  success: 'border-accent/30 bg-[#0b1a15]/95 text-accent-300',
  error: 'border-rose-500/30 bg-[#1a0d10]/95 text-rose-300',
  info: 'border-cyan-400/25 bg-[#0a161b]/95 text-cyan-300',
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);

      const timer = setTimeout(() => dismiss(id), 4500);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-end gap-2 px-4 sm:inset-x-auto sm:right-5 sm:top-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];

          return (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md',
                STYLES[toast.kind],
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-100">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-0.5 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Закрыть уведомление"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast должен использоваться внутри ToastProvider');
  }

  return context;
}
