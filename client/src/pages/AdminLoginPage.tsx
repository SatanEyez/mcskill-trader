import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { ApiError, register as registerRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/layout/Logo';
import { Spinner } from '../components/ui/Spinner';

type Mode = 'login' | 'register';

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/;
const PASSWORD_MIN = 6;

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  invalid,
  describedBy,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <KeyRound
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder="••••••••"
          className="field py-3 pl-10 pr-11"
          aria-invalid={invalid}
          aria-describedby={invalid ? describedBy : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function AdminLoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('login');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registeredLogin, setRegisteredLogin] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldError(null);
    setConfirmPassword('');
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginValue.trim() || !password || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(loginValue.trim(), password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : 'Не удалось выполнить вход. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedLogin = loginValue.trim();

    if (!LOGIN_PATTERN.test(trimmedLogin)) {
      setFieldError('Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание');
      return;
    }

    if (password.length < PASSWORD_MIN) {
      setFieldError(`Пароль должен содержать минимум ${PASSWORD_MIN} символов`);
      return;
    }

    if (password !== confirmPassword) {
      setFieldError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldError(null);

    try {
      await registerRequest(trimmedLogin, password);
      setRegisteredLogin(trimmedLogin);
      setPassword('');
      setConfirmPassword('');
    } catch (registerError) {
      setError(
        registerError instanceof ApiError
          ? registerError.message
          : 'Не удалось отправить заявку. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderRegisterSuccess = () => (
    <div className="text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-accent/25 bg-accent/[0.08]">
        <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden />
      </span>

      <h1 className="mt-5 text-2xl font-semibold text-white">Заявка отправлена</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Аккаунт <span className="font-semibold text-slate-200">«{registeredLogin}»</span> создан и
        ожидает одобрения. Как только администратор подтвердит доступ, вы сможете войти под своим
        логином.
      </p>

      <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
        Заявку можно увидеть в админ-панели на вкладке «Пользователи».
      </div>

      <button
        type="button"
        onClick={() => {
          setRegisteredLogin(null);
          switchMode('login');
        }}
        className="btn btn-primary mt-5 w-full py-3"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Вернуться ко входу
      </button>
    </div>
  );

  const renderLoginForm = () => (
    <>
      <h1 className="mt-5 text-2xl font-semibold text-white">Вход в админ-панель</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Управление каталогом, ценами и администраторами.
      </p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="admin-login" className="field-label">
            Логин
          </label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              id="admin-login"
              value={loginValue}
              onChange={(event) => {
                setLoginValue(event.target.value);
                if (error) setError(null);
              }}
              autoFocus
              autoComplete="username"
              placeholder="admin"
              className="field py-3 pl-10"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
        </div>

        <PasswordInput
          id="admin-password"
          label="Пароль"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
          autoComplete="current-password"
          invalid={Boolean(error)}
          describedBy="login-error"
        />

        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !loginValue.trim() || password.length === 0}
          className="btn btn-primary w-full py-3"
        >
          {submitting ? (
            <>
              <Spinner />
              Проверяем…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Войти
            </>
          )}
        </button>
      </form>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={() => switchMode('register')}
          className="btn btn-secondary w-full py-2.5 text-xs"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          Зарегистрироваться
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          Новые аккаунты получают доступ только после одобрения действующим администратором.
        </p>
      </div>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <h1 className="mt-5 text-2xl font-semibold text-white">Заявка на доступ</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Придумайте логин и пароль. Доступ откроется после одобрения администратором.
      </p>

      <form onSubmit={handleRegister} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="register-login" className="field-label">
            Логин
          </label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              id="register-login"
              value={loginValue}
              onChange={(event) => {
                setLoginValue(event.target.value);
                if (error) setError(null);
                if (fieldError) setFieldError(null);
              }}
              autoFocus
              autoComplete="username"
              placeholder="nickname"
              maxLength={32}
              className={clsx('field py-3 pl-10', fieldError && 'border-rose-500/60')}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            3–32 символа: латиница, цифры, точка, дефис или подчёркивание.
          </p>
        </div>

        <PasswordInput
          id="register-password"
          label={`Пароль (минимум ${PASSWORD_MIN} символов)`}
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (error) setError(null);
            if (fieldError) setFieldError(null);
          }}
          autoComplete="new-password"
          invalid={Boolean(fieldError)}
          describedBy="register-error"
        />

        <PasswordInput
          id="register-password-confirm"
          label="Повторите пароль"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            if (fieldError) setFieldError(null);
          }}
          autoComplete="new-password"
          invalid={Boolean(fieldError)}
          describedBy="register-error"
        />

        {(fieldError || error) && (
          <p
            id="register-error"
            role="alert"
            className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5 text-xs text-rose-300"
          >
            {fieldError ?? error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !loginValue.trim() || password.length === 0}
          className="btn btn-primary w-full py-3"
        >
          {submitting ? (
            <>
              <Spinner />
              Отправляем…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" aria-hidden />
              Отправить заявку
            </>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => switchMode('login')}
        className="btn btn-ghost mt-4 w-full py-2.5 text-xs text-slate-400 hover:text-white"
      >
        Уже есть доступ? Войти
      </button>
    </>
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-10rem] h-96 w-[42rem] -translate-x-1/2 rounded-full bg-accent/[0.1] blur-[120px]"
        aria-hidden
      />

      <div className="container-page relative flex flex-1 flex-col">
        <div className="flex items-center justify-between py-6">
          <Logo />
          <Link
            to="/"
            className="btn btn-ghost px-3 py-2 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            На сайт
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center pb-16">
          <div className="w-full max-w-md animate-fade-up">
            <div className="panel relative overflow-hidden p-6 sm:p-8">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-accent/[0.08] blur-3xl"
                aria-hidden
              />

              <div className="relative">
                {registeredLogin ? (
                  renderRegisterSuccess()
                ) : (
                  <>
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent/25 bg-accent/[0.08] shadow-glow-sm">
                      <LockKeyhole className="h-5 w-5 text-accent" aria-hidden />
                    </span>
                    {mode === 'login' ? renderLoginForm() : renderRegisterForm()}
                  </>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-600">
              Сессия действует 12 часов. Все действия администраторов записываются в журнал.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
