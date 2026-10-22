import type { CSSProperties } from 'react';
import clsx from 'clsx';

/** Минимум данных о префиксе, который нужен для вывода названия. */
export interface PrefixLike {
  name: string;
  color: string;
  /** «Shiny»-эффект: по тексту бежит светлая полоса и вспыхивают искры. */
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
 * Без «shiny» — обычный цветной текст. С «shiny» — обёртка с переливающимся
 * текстом (`.prefix-shiny`) и тремя искрами вокруг него. Цвет приходит
 * в CSS-переменную `--prefix-shiny-color`, а не в `color`: эффект делает буквы
 * прозрачными и рисует градиент внутри них, поэтому `currentColor` в градиенте
 * оказался бы тоже прозрачным. От этой же переменной CSS считает оттенок
 * блеска и цвет искр, поэтому у каждого префикса свой перелив.
 */
export function PrefixName({ prefix, className, suffix, title }: PrefixNameProps) {
  const label = (
    <>
      {prefix.name}
      {suffix}
    </>
  );

  if (!prefix.is_shiny) {
    return (
      <span className={className} style={{ color: prefix.color }} title={title}>
        {label}
      </span>
    );
  }

  return (
    <span
      className="prefix-shiny-wrap"
      style={{ '--prefix-shiny-color': prefix.color } as CSSProperties}
      title={title}
      data-shiny="true"
    >
      <span className={clsx('prefix-shiny', className)}>{label}</span>
      <span className="prefix-spark prefix-spark-1" aria-hidden />
      <span className="prefix-spark prefix-spark-2" aria-hidden />
      <span className="prefix-spark prefix-spark-3" aria-hidden />
    </span>
  );
}
