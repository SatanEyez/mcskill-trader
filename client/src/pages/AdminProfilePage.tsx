import { useEffect, useRef, useState } from 'react';
import { Camera, Crown, ImagePlus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { ApiError, deleteAvatar, uploadAvatar } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTimeMsk } from '../lib/format';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Spinner } from '../components/ui/Spinner';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function AdminProfilePage() {
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();

  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Профиль — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Локальный предпросмотр выбранного файла: освобождаем blob при замене.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  if (!user) return null;

  const prefixColor = user.prefix?.color ?? '#34D399';
  const roleLabel = user.role_name ?? (user.role === 'owner' ? 'Владелец' : 'Администратор');

  const handlePick = (file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify('Нужен PNG, JPG, WebP или GIF', 'error');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      notify('Файл больше 2 МБ — уменьшите изображение', 'error');
      return;
    }

    setPendingFile(file);
  };

  const handleUpload = async () => {
    if (!pendingFile || busy) return;

    setBusy(true);

    try {
      const updated = await uploadAvatar(pendingFile);
      await refreshUser();
      setPendingFile(null);
      if (fileInput.current) fileInput.current.value = '';
      notify(`Аватар «${updated.login}» обновлён`, 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Не удалось загрузить аватар', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await deleteAvatar();
      await refreshUser();
      setPendingFile(null);
      if (fileInput.current) fileInput.current.value = '';
      notify('Аватар удалён', 'info');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Не удалось удалить аватар', 'error');
    } finally {
      setBusy(false);
    }
  };

  const shownAvatar = previewUrl ?? user.avatar_url;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Аккаунт
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Мой профиль</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Аватар хранится в базе данных вместе с остальными данными, поэтому переживает
            перезаливку и деплой.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Camera className="h-4 w-4 text-accent" aria-hidden />
              Аватар
            </h2>

            <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <span
                className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border text-3xl font-semibold uppercase"
                style={{
                  color: prefixColor,
                  borderColor: `${prefixColor}55`,
                  backgroundColor: `${prefixColor}14`,
                }}
              >
                {shownAvatar ? (
                  <img
                    src={shownAvatar}
                    alt={`Аватар ${user.login}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user.login.slice(0, 1)
                )}
              </span>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-sm font-semibold text-white">{user.login}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  PNG, JPG, WebP или GIF · до 2 МБ. Картинка обрезается по центру.
                </p>

                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <input
                    ref={fileInput}
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    className="hidden"
                    onChange={(event) => handlePick(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                    className="btn btn-secondary px-3 py-2 text-xs"
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                    Выбрать файл
                  </button>

                  {pendingFile && (
                    <button
                      type="button"
                      onClick={() => void handleUpload()}
                      disabled={busy}
                      className="btn btn-primary px-3 py-2 text-xs"
                    >
                      {busy ? <Spinner /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
                      Сохранить
                    </button>
                  )}

                  {user.avatar_url && !pendingFile && (
                    <button
                      type="button"
                      onClick={() => void handleRemove()}
                      disabled={busy}
                      className="btn btn-ghost px-3 py-2 text-xs text-slate-400 hover:text-rose-300"
                    >
                      {busy ? <Spinner /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                      Удалить
                    </button>
                  )}
                </div>

                {pendingFile && (
                  <p className="mt-2 truncate text-[11px] text-slate-500">
                    Выбран: {pendingFile.name}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <UserRound className="h-4 w-4 text-accent" aria-hidden />
              Данные аккаунта
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Логин</dt>
                <dd className="font-medium text-white">{user.login}</dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Роль</dt>
                <dd className="flex items-center gap-1.5 font-medium text-white">
                  {user.role === 'owner' ? (
                    <Crown className="h-3.5 w-3.5 text-fuchsia-300" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
                  )}
                  {roleLabel}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Префикс</dt>
                <dd className="font-medium" style={{ color: prefixColor }}>
                  {user.prefix?.name ?? 'нет'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Статус</dt>
                <dd className="font-medium text-white">
                  {user.status === 'approved' ? 'Одобрен' : user.status}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Аккаунт создан</dt>
                <dd className="text-right text-slate-300">{formatDateTimeMsk(user.created_at)}</dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Последний вход</dt>
                <dd className="text-right text-slate-300">
                  {user.last_login_at ? formatDateTimeMsk(user.last_login_at) : 'ещё не входил'}
                </dd>
              </div>
            </dl>

            <div
              className={clsx(
                'mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-slate-500',
              )}
            >
              Права: {user.permissions.includes('*') ? 'полный доступ' : user.permissions.join(', ') || 'нет'}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
