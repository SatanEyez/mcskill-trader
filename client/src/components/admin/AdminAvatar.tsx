import clsx from 'clsx';

const SIZE_CLASS = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-24 w-24 text-3xl',
} as const;

const ROUNDED_CLASS = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
} as const;

interface AdminAvatarProps {
  login: string;
  avatarUrl: string | null;
  /** Цвет префикса: рамка и подложка при отсутствии картинки. */
  color?: string;
  size?: keyof typeof SIZE_CLASS;
  rounded?: keyof typeof ROUNDED_CLASS;
  /** Сколько букв логина показывать, если аватар не загружен. */
  initials?: number;
  className?: string;
}

/**
 * Аватар администратора: загруженная картинка или инициалы в цвете префикса.
 * Используется везде, где в интерфейсе фигурирует администратор.
 */
export function AdminAvatar({
  login,
  avatarUrl,
  color = '#34D399',
  size = 'md',
  rounded = 'lg',
  initials = 2,
  className,
}: AdminAvatarProps) {
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center overflow-hidden border font-semibold uppercase',
        SIZE_CLASS[size],
        ROUNDED_CLASS[rounded],
        className,
      )}
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" aria-hidden className="h-full w-full object-cover" />
      ) : (
        login.slice(0, initials).toUpperCase()
      )}
    </span>
  );
}
