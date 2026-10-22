import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { themePrefixColor } from '../../lib/theme';

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
 * Цвет зависит от активной темы сайта: обычная тема оставляет цвет как есть,
 * хэллоуин подмешивает тыквенный оранжевый, новый год — ледяной голубой
 * (`themePrefixColor`). Так сезонное оформление автоматически подхватывает
 * и префиксы, без ручной правки каждого.
 *
 * Без «shiny» — цветной текст. С «shiny» — обёртка с переливающимся текстом
 * (`.prefix-shiny`) и четырьмя искрами вокруг него. Цвет приходит в CSS-переменную
 * `--prefix-shiny-color`, а не в `color`: эффект делает буквы прозрачными и рисует
 * градиент внутри них, поэтому `currentColor` в градиенте оказался бы тоже
 * прозрачным. От этой же переменной CSS считает оттенок блеска и цвет искр,
 * поэтому у каждого префикса свой перелив.
 */
export function PrefixName({ prefix, className, suffix, title }: PrefixNameProps) {
  const { theme } = useSiteSettings();
  const color = themePrefixColor(prefix.color, theme);
  const themeClass = theme === 'default' ? null : `prefix-theme-${theme}`;

  const label = (
    <>
      {prefix.name}
      {suffix}
    </>
  );

  if (!prefix.is_shiny) {
    return (
      <span
        className={clsx('prefix-name', themeClass, className)}
        style={{ color }}
        title={title}
        data-theme={theme}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={clsx('prefix-shiny-wrap', themeClass)}
      style={{ '--prefix-shiny-color': color } as CSSProperties}
      title={title}
      data-shiny="true"
      data-theme={theme}
    >
      <span className={clsx('prefix-shiny', className)}>{label}</span>
      <span className="prefix-spark prefix-spark-1" aria-hidden />
      <span className="prefix-spark prefix-spark-2" aria-hidden />
      <span className="prefix-spark prefix-spark-3" aria-hidden />
      <span className="prefix-spark prefix-spark-4" aria-hidden />
    </span>
  );
}
