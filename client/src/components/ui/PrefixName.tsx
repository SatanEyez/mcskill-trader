import type { CSSProperties } from 'react';
import clsx from 'clsx';

/** Минимум данных о префиксе, который нужен для вывода названия. */
export interface PrefixLike {
  name: string;
  color: string;
  /** «Shiny»-эффект: по тексту бежит светлая полоса. */
  is_shiny?: boolean | null;
}

interface PrefixNameProps {
  prefix: PrefixLike;
  /** Внешний вид с места вывода: размер, регистр, обрезка. */
  className?: string;
  /** Хвост после названия — обычно «· login». */
  suffix?: string;
  title?: string;
}

/**
 * Название префикса администратора.
 *
 * Если у префикса включён «shiny», текст переливается (класс `.prefix-shiny`).
 * Цвет приходит в CSS-переменную `--prefix-shiny-color`, а не в `color`:
 * эффект делает буквы прозрачными и рисует градиент внутри них, поэтому
 * `currentColor` в градиенте оказался бы тоже прозрачным.
 */
export function PrefixName({ prefix, className, suffix, title }: PrefixNameProps) {
  return (
    <span
      className={clsx(prefix.is_shiny && 'prefix-shiny', className)}
      style={
        {
          color: prefix.color,
          '--prefix-shiny-color': prefix.color,
        } as CSSProperties
      }
      title={title}
      data-shiny={prefix.is_shiny ? 'true' : undefined}
    >
      {prefix.name}
      {suffix}
    </span>
  );
}
