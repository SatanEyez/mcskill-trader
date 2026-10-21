import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  MessageSquarePlus,
  MessagesSquare,
  Pencil,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';
import { formatDateMsk, formatDateTimeMsk, formatTimeMsk } from '../lib/format';
import { isChatSoundEnabled, CHAT_SOUND_CHANGED_EVENT } from '../lib/chat-sound';
import { ApiError, fetchChatAccessLevels, uploadImage } from '../lib/api';
import type { ChatAccessLevel, ChatMessage, ChatRoom } from '../types';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { AdminAvatar } from '../components/admin/AdminAvatar';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function previewOf(room: ChatRoom): string {
  if (!room.last_message) return 'Сообщений пока нет';

  const text = room.last_message.message.replace(/\s+/g, ' ').trim();

  return text
    ? `${room.last_message.login}: ${text}`
    : `${room.last_message.login}: 📷 Фото`;
}

function roomTime(room: ChatRoom): string {
  const stamp = room.last_message?.created_at ?? room.created_at;
  return formatTimeMsk(stamp);
}

function MessageBubble({
  message,
  own,
  hidePrefix,
  onOpenImage,
}: {
  message: ChatMessage;
  own: boolean;
  hidePrefix: boolean;
  onOpenImage: (url: string) => void;
}) {
  const prefix = hidePrefix ? null : message.user_prefix;

  return (
    <div className={clsx('flex w-full gap-2.5', own ? 'flex-row-reverse' : 'flex-row')}>
      <AdminAvatar
        login={message.user_login}
        avatarUrl={message.avatar_url}
        size="sm"
        rounded="xl"
        initials={1}
      />

      <div className={clsx('flex min-w-0 max-w-[78%] flex-col', own ? 'items-end' : 'items-start')}>
        <div className="flex flex-wrap items-baseline gap-1.5 text-[10px] text-slate-500">
          {prefix && (
            <span
              className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: prefix.color,
                borderColor: `${prefix.color}55`,
                backgroundColor: `${prefix.color}1a`,
              }}
              title={`Префикс: ${prefix.name}`}
            >
              {prefix.name}
            </span>
          )}
          <span className="font-medium text-slate-400">{message.user_login}</span>
          <span>{formatTimeMsk(message.created_at)}</span>
        </div>

        {message.image_url && (
          <button
            type="button"
            onClick={() => onOpenImage(message.image_url as string)}
            className="group/photo mt-1 block cursor-zoom-in overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 transition hover:border-accent/40"
            title="Открыть фото"
          >
            <img
              src={message.image_url}
              alt="Фото в чате"
              loading="lazy"
              className="max-h-72 max-w-full object-contain transition duration-300 group-hover/photo:scale-[1.03]"
            />
          </button>
        )}

        {message.message && (
          <div
            className={clsx(
              'mt-1 whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2 text-sm leading-relaxed shadow-sm',
              own
                ? 'rounded-tr-md border-accent/25 bg-accent/[0.12] text-accent-50'
                : 'rounded-tl-md border-white/[0.07] bg-white/[0.04] text-slate-200',
            )}
          >
            {message.message}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminChatPage() {
  const { user, can } = useAuth();
  const canCreate = can('chat.create');
  const canEdit = can('chat.edit');
  const canDelete = can('chat.delete');
  const myLevel = user?.access_level ?? 0;
  const {
    rooms,
    activeRoomId,
    messages,
    loadingRooms,
    loadingMessages,
    loadingOlder,
    sending,
    error,
    hasMore,
    selectRoom,
    loadOlder,
    send,
    createRoom,
    updateRoom,
    deleteRoom,
    reload,
  } = useChat();

  const [draft, setDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomAccess, setRoomAccess] = useState(0);
  const [roomPrefixLevel, setRoomPrefixLevel] = useState(0);
  const [accessLevels, setAccessLevels] = useState<ChatAccessLevel[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(isChatSoundEnabled);
  const [attachImage, setAttachImage] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Правка комнаты: название и аватар (право chat.edit).
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Удаление комнаты (право chat.delete). Цель храним отдельно: после удаления
  // активная комната сбрасывается, а модалке ещё нужно показать её название.
  const [deleteTarget, setDeleteTarget] = useState<ChatRoom | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const clearAttachment = () => {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachImage(null);
    setAttachPreview(null);
    setUploadError(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Неподдерживаемый формат: нужен PNG, JPG, WebP или GIF');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setUploadError('Файл слишком большой (макс. 5 МБ)');
      event.target.value = '';
      return;
    }

    setUploadError(null);
    setAttachImage(file);
    setAttachPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  // Очистка blob URL при смене превью или размонтировании
  useEffect(() => {
    return () => {
      if (attachPreview) URL.revokeObjectURL(attachPreview);
    };
  }, [attachPreview]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const nearBottomRef = useRef(true);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const totalUnread = rooms.reduce((sum, room) => sum + room.unread_count, 0);
  // Префиксы в комнате скрыты, если у зрителя доступ ниже порога комнаты.
  const hidePrefixes = activeRoom !== null && myLevel < activeRoom.prefix_level;

  // Справочник уровней доступа: подписи в списке комнат и в форме создания.
  useEffect(() => {
    let active = true;

    fetchChatAccessLevels()
      .then((data) => {
        if (active) setAccessLevels(data.levels);
      })
      .catch(() => {
        // Без справочника покажем «Уровень N» — не критично для работы чата.
      });

    return () => {
      active = false;
    };
  }, []);

  const levelLabel = (level: number): string => {
    if (level === 0) return 'Все с доступом к чату';
    return accessLevels.find((entry) => entry.level === level)?.label ?? `Уровень ${level}`;
  };

  /** Уровни, которые пользователь вправе выставить: не выше собственного. */
  const availableLevels = accessLevels.filter((entry) => entry.level <= myLevel);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Служебный чат — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!previewImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewImage]);

  useEffect(() => {
    const sync = () => setSoundEnabled(isChatSoundEnabled());
    window.addEventListener(CHAT_SOUND_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHAT_SOUND_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Прокрутка: вниз при открытии комнаты и когда пользователь у нижнего края.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    if (nearBottomRef.current || messages.length <= 1) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, activeRoomId]);

  useEffect(() => {
    nearBottomRef.current = true;
  }, [activeRoomId]);

  const handleScroll = () => {
    const container = listRef.current;
    if (!container) return;

    nearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if ((!draft.trim() && !attachImage) || sending || uploading) return;

    let imageUrl: string | null = null;

    if (attachImage) {
      setUploading(true);
      setUploadError(null);
      try {
        const uploaded = await uploadImage(attachImage);
        imageUrl = uploaded.url;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить фото';
        setUploadError(msg);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const ok = await send(draft, imageUrl);
    if (ok) {
      setDraft('');
      clearAttachment();
      nearBottomRef.current = true;
      inputRef.current?.focus();
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!roomName.trim() || creating) return;

    setCreating(true);
    setCreateError(null);

    const room = await createRoom(roomName.trim(), {
      accessLevel: roomAccess,
      prefixLevel: roomPrefixLevel,
    });
    setCreating(false);

    if (!room) {
      setCreateError('Не удалось создать комнату');
      return;
    }

    setCreateOpen(false);
    setRoomName('');
    setRoomAccess(0);
    setRoomPrefixLevel(0);
    await selectRoom(room.id);
  };

  const openRoom = (roomId: string) => {
    void selectRoom(roomId);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const openEdit = () => {
    if (!activeRoom) return;

    setEditName(activeRoom.name);
    setEditAvatar(activeRoom.avatar_url);
    setEditError(null);
    setEditOpen(true);
  };

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setEditError('Неподдерживаемый формат: нужен PNG, JPG, WebP или GIF');
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setEditError('Файл слишком большой (макс. 5 МБ)');
      return;
    }

    setEditUploading(true);
    setEditError(null);

    try {
      const uploaded = await uploadImage(file);
      setEditAvatar(uploaded.url);
    } catch (uploadFailure) {
      setEditError(
        uploadFailure instanceof ApiError
          ? uploadFailure.message
          : 'Не удалось загрузить аватар',
      );
    } finally {
      setEditUploading(false);
    }
  };

  const handleSaveEdit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!activeRoom || savingEdit || editUploading) return;

    const name = editName.trim();

    if (name.length < 2) {
      setEditError('Название должно содержать минимум 2 символа');
      return;
    }

    const nameChanged = name !== activeRoom.name;
    const avatarChanged = editAvatar !== activeRoom.avatar_url;

    if (!nameChanged && !avatarChanged) {
      setEditOpen(false);
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    const updated = await updateRoom(activeRoom.id, {
      ...(nameChanged ? { name } : {}),
      ...(avatarChanged ? { avatarUrl: editAvatar } : {}),
    });

    setSavingEdit(false);

    if (!updated) {
      setEditError('Не удалось сохранить изменения');
      return;
    }

    setEditOpen(false);
  };

  const handleDeleteRoom = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    const ok = await deleteRoom(deleteTarget.id);

    setDeleting(false);

    if (!ok) {
      setDeleteError('Не удалось удалить комнату');
      return;
    }

    setDeleteTarget(null);
  };

  const lastDayRef = useRef<string | null>(null);

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Команда
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Служебный чат</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Внутренняя переписка администрации. Сообщения сохраняются в базе, непрочитанные
              считаются по комнатам.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-accent" aria-hidden />
            ) : (
              <VolumeX className="h-3.5 w-3.5" aria-hidden />
            )}
            Звук уведомлений{' '}
            <Link to="/admin/profile" className="text-accent hover:text-accent-300">
              {soundEnabled ? 'включён' : 'выключен'} · настроить
            </Link>
          </div>
        </div>

        <div className="mt-5 grid overflow-hidden rounded-2xl border border-white/[0.06] bg-panel/60 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Список комнат */}
          <aside
            className={clsx(
              'flex min-h-0 flex-col border-white/[0.06] bg-black/20 lg:h-[600px] lg:border-r',
              activeRoom ? 'hidden lg:flex' : 'flex',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
                Комнаты
                {totalUnread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-[#04110c]">
                    {totalUnread}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void reload(true)}
                className="icon-btn h-7 w-7"
                title="Обновить список"
                aria-label="Обновить список комнат"
              >
                <Spinner className={clsx('h-3 w-3', loadingRooms && 'animate-spin')} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loadingRooms && rooms.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-500">Загружаем…</p>
              ) : rooms.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-500">
                  Комнат пока нет. Создайте первую.
                </p>
              ) : (
                <ul className="space-y-1">
                  {rooms.map((room) => (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => openRoom(room.id)}
                        title={
                          room.access_level > 0
                            ? `Доступ: ${levelLabel(room.access_level)}`
                            : 'Доступ: все с правом на чат'
                        }
                        className={clsx(
                          'w-full rounded-xl px-3 py-2.5 text-left transition',
                          room.id === activeRoomId
                            ? 'bg-accent/[0.12] ring-1 ring-inset ring-accent/25'
                            : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={clsx(
                              'flex min-w-0 items-center gap-1.5 truncate text-sm font-medium',
                              room.id === activeRoomId ? 'text-accent' : 'text-slate-200',
                            )}
                          >
                            {room.avatar_url ? (
                              <img
                                src={room.avatar_url}
                                alt=""
                                loading="lazy"
                                className="h-5 w-5 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            ) : (
                              <span className="text-slate-500">#</span>
                            )}
                            <span className="truncate">{room.name}</span>
                            {room.access_level > 0 && (
                              <Lock
                                className="h-3 w-3 shrink-0 text-amber-300/70"
                                aria-label="Ограниченный доступ"
                              />
                            )}
                          </span>

                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[10px] text-slate-600">{roomTime(room)}</span>
                            {room.unread_count > 0 && (
                              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-400/90 px-1 text-[10px] font-bold text-[#1b0505]">
                                {room.unread_count > 99 ? '99+' : room.unread_count}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          {previewOf(room)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-white/[0.06] p-2">
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setRoomName('');
                    setRoomAccess(0);
                    setRoomPrefixLevel(0);
                    setCreateOpen(true);
                  }}
                  className="btn btn-secondary w-full px-3 py-2 text-xs"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                  Создать комнату
                </button>
              ) : (
                <p className="px-2 py-1.5 text-[10px] leading-relaxed text-slate-600">
                  Создание комнат доступно не всем — право выдаёт владелец в разделе «Доступ».
                </p>
              )}
            </div>
          </aside>

          {/* Окно переписки */}
          <section
            className={clsx(
              'flex min-h-0 flex-col lg:h-[600px]',
              activeRoom ? 'flex' : 'hidden lg:flex',
            )}
          >
            {!activeRoom ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                  <MessagesSquare className="h-6 w-6 text-slate-500" aria-hidden />
                </span>
                <p className="text-sm font-medium text-white">Выберите комнату</p>
                <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                  Слева — список каналов команды. Непрочитанные сообщения отмечены счётчиком.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.history.back();
                      }}
                      className="icon-btn h-7 w-7 shrink-0 lg:hidden"
                      aria-label="Назад к комнатам"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    </button>

                    {activeRoom.avatar_url ? (
                      <img
                        src={activeRoom.avatar_url}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-slate-500"
                        aria-hidden
                      >
                        #
                      </span>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {activeRoom.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {activeRoom.created_by_login
                          ? `создал ${activeRoom.created_by_login}`
                          : 'общий канал'}{' '}
                        · {formatDateTimeMsk(activeRoom.created_at)}
                        {activeRoom.access_level > 0
                          ? ` · доступ: ${levelLabel(activeRoom.access_level)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={openEdit}
                        className="icon-btn h-7 w-7"
                        title="Изменить название и аватар"
                        aria-label="Изменить комнату"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(activeRoom);
                        }}
                        className="icon-btn h-7 w-7 hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300"
                        title="Удалить комнату"
                        aria-label="Удалить комнату"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>

                {hidePrefixes && (
                  <p className="flex items-center gap-1.5 border-b border-white/[0.06] bg-amber-400/[0.06] px-4 py-1.5 text-[10px] text-amber-200/80">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    Префиксы скрыты: в этой комнате их видят только с доступа «
                    {levelLabel(activeRoom.prefix_level)}»
                  </p>
                )}

                <div
                  ref={listRef}
                  onScroll={handleScroll}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                  {hasMore && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadOlder()}
                        disabled={loadingOlder}
                        className="btn btn-secondary px-3 py-1.5 text-[11px]"
                      >
                        {loadingOlder ? <Spinner className="h-3 w-3" /> : null}
                        Загрузить более ранние
                      </button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <p className="py-10 text-center text-xs text-slate-500">Загружаем сообщения…</p>
                  ) : messages.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-500">
                      Сообщений пока нет — напишите первым.
                    </p>
                  ) : (
                    messages.map((message) => {
                      const own = message.user_id !== null && message.user_id === user?.id;
                      const day = formatDateMsk(message.created_at);
                      const showDay = day !== lastDayRef.current;

                      if (showDay) {
                        lastDayRef.current = day;
                      }

                      return (
                        <div key={message.id}>
                          {showDay && (
                            <p className="mb-2 mt-1 text-center text-[10px] uppercase tracking-[0.14em] text-slate-600">
                              {day}
                            </p>
                          )}
                          <MessageBubble
                            message={message}
                            own={own}
                            hidePrefix={hidePrefixes}
                            onOpenImage={setPreviewImage}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {error && (
                  <p className="border-t border-rose-400/20 bg-rose-400/[0.06] px-4 py-2 text-[11px] text-rose-200">
                    {error}
                  </p>
                )}

                {attachPreview && (
                  <div className="relative border-t border-white/[0.06] p-3 flex items-center gap-2">
                    <img
                      src={attachPreview}
                      alt="Прикреплённое фото"
                      className="h-16 w-16 rounded-lg object-cover border border-white/[0.08]"
                    />
                    <span className="text-sm text-slate-300 flex-1 truncate">
                      {attachImage?.name}
                    </span>
                    {uploadError && (
                      <span className="text-[11px] text-rose-300">{uploadError}</span>
                    )}
                    <button
                      type="button"
                      onClick={clearAttachment}
                      disabled={uploading}
                      className="p-1.5 rounded hover:bg-white/[0.05] text-slate-400 hover:text-white transition"
                      aria-label="Удалить фото"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-white/[0.06] p-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploading || !!attachImage}
                    className="btn btn-ghost shrink-0 p-2"
                    aria-label="Прикрепить фото"
                    title="Прикрепить фото"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={attachImage ? 'Добавьте подпись…' : `Сообщение в #${activeRoom?.name}…`}
                    maxLength={4000}
                    className="field flex-1 py-2.5 text-sm"
                    aria-label="Текст сообщения"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="chat-file-input"
                    disabled={sending || uploading || !!attachImage}
                  />
                  <button
                    type="submit"
                    disabled={sending || uploading || (!draft.trim() && !attachImage)}
                    className="btn btn-primary shrink-0 px-3.5 py-2.5"
                    aria-label="Отправить сообщение"
                  >
                    {sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>

      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото"
          onClick={() => setPreviewImage(null)}
          className="animate-fade-in fixed inset-0 z-[60] grid cursor-zoom-out place-items-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Закрыть фото"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <img
            src={previewImage}
            alt="Фото из чата"
            onClick={(event) => event.stopPropagation()}
            className="animate-photo-in max-h-[86vh] max-w-[92vw] cursor-default rounded-2xl border border-white/10 object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          />
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новая комната"
        description={
          roomAccess > 0
            ? `Канал увидят только с доступа «${levelLabel(roomAccess)}» и выше.`
            : 'Канал увидят все администраторы с доступом к чату.'
        }
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost">
              Отмена
            </button>
            <button
              type="button"
              onClick={(event) => void handleCreate(event)}
              disabled={creating || roomName.trim().length < 2}
              className="btn btn-primary"
            >
              {creating ? <Spinner /> : <MessageSquarePlus className="h-4 w-4" aria-hidden />}
              Создать
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="field-label">Название комнаты</span>
            <input
              value={roomName}
              onChange={(event) => {
                setRoomName(event.target.value);
                setCreateError(null);
              }}
              placeholder="Например, Смена"
              maxLength={60}
              autoFocus
              className="field"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreate(event);
                }
              }}
            />
          </label>

          <label className="block">
            <span className="field-label">Кто видит комнату</span>
            <select
              value={roomAccess}
              onChange={(event) => {
                setRoomAccess(Number(event.target.value));
                setCreateError(null);
              }}
              className="field"
            >
              {availableLevels.map((entry) => (
                <option key={entry.level} value={entry.level}>
                  {entry.level === 0 ? 'Все с доступом к чату' : `${entry.label} и выше`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
              Комнату не увидят те, чей доступ ниже выбранного.
            </span>
          </label>

          <label className="block">
            <span className="field-label">Кому видны префиксы</span>
            <select
              value={roomPrefixLevel}
              onChange={(event) => {
                setRoomPrefixLevel(Number(event.target.value));
                setCreateError(null);
              }}
              className="field"
            >
              <option value={0}>Всем участникам комнаты</option>
              {availableLevels
                .filter((entry) => entry.level > 0)
                .map((entry) => (
                  <option key={entry.level} value={entry.level}>
                    {entry.label} и выше
                  </option>
                ))}
            </select>
            <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
              Должности (префиксы) авторов увидят только с выбранного доступа.
            </span>
          </label>

          {createError && <p className="text-[11px] text-rose-300">{createError}</p>}
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Настройки комнаты"
        description="Название и аватар видят все, у кого есть доступ к комнате."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-ghost">
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit || editUploading || editName.trim().length < 2}
              className="btn btn-primary"
            >
              {savingEdit ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />}
              Сохранить
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-void/60">
              {editAvatar ? (
                <img src={editAvatar} alt="Аватар комнаты" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-600">#</span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={editUploading}
                  className="btn btn-secondary px-3 py-2 text-xs"
                >
                  {editUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {editAvatar ? 'Заменить' : 'Загрузить'}
                </button>

                {editAvatar && (
                  <button
                    type="button"
                    onClick={() => setEditAvatar(null)}
                    disabled={editUploading}
                    className="btn btn-ghost px-3 py-2 text-xs"
                  >
                    Убрать
                  </button>
                )}
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                PNG, JPG, WebP или GIF до 5 МБ. Квадратная картинка смотрится лучше.
              </p>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarSelect}
              className="hidden"
              aria-label="Файл аватара комнаты"
            />
          </div>

          <label className="block">
            <span className="field-label">Название</span>
            <input
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);
                setEditError(null);
              }}
              placeholder="Например, Смена"
              maxLength={60}
              className="field"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSaveEdit();
                }
              }}
            />
          </label>

          {editError && <p className="text-[11px] text-rose-300">{editError}</p>}
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить комнату?"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="btn btn-ghost"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteRoom()}
              disabled={deleting}
              className="btn btn-danger"
            >
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Удалить
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-300">
            Комната{' '}
            <span className="font-semibold text-white">«{deleteTarget?.name}»</span> и вся её
            переписка будут удалены безвозвратно.
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Сообщения, фото и отметки прочтения исчезнут у всех администраторов. Восстановить их
            нельзя — если переписка нужна, сохраните её заранее.
          </p>

          {deleteError && <p className="text-[11px] text-rose-300">{deleteError}</p>}
        </div>
      </Modal>
    </div>
  );
}
