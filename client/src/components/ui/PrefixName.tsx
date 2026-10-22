import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import type { SiteTheme } from '../../types';
import { BatIcon } from '../halloween/HalloweenIcons';
import { SnowflakeIcon } from '../newyear/NewYearIcons';

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
 * Цвет всегда свой, из настроек префикса: сезонная тема его не трогает.
 * Меняется только декор вокруг — и это единственное, чем темы отличаются здесь.
 * Обычная тема оставляет четыре искры-звёздочки, Новый год ставит снежинки
 * над текстом, Хэллоуин — маленьких летучих мышей по бокам.
 *
 * Декор летает вокруг текста абсолютом. Чтобы его не срезало `overflow: hidden`
 * у родителя (префикс часто живёт в `<p class="truncate">`), обёртка в сезонных
 * темах получает вертикальные отступы — они расширяют строку и дают декору
 * место над и под буквами.
 *
 * Без «shiny» — цветной текст без декора. С «shiny» — обёртка с переливающимся
 * текстом (`.prefix-shiny`) и декором вокруг. Цвет приходит в CSS-переменную
 * `--prefix-shiny-color`, а не в `color`: эффект делает буквы прозрачными и рисует
 * градиент внутри них, поэтому `currentColor` в градиенте оказался бы тоже
 * прозрачным. От этой же переменной CSS считает оттенок блеска и цвет искр,
 * поэтому у каждого префикса свой перелив.
 */
export function PrefixName({ prefix, className, suffix, title }: PrefixNameProps) {
  const { theme } = useSiteSettings();
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
        style={{ color: prefix.color }}
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
      style={{ '--prefix-shiny-color': prefix.color } as CSSProperties}
      title={title}
      data-shiny="true"
      data-theme={theme}
    >
      <span className={clsx('prefix-shiny', className)}>{label}</span>
      <PrefixOrnaments theme={theme} />
    </span>
  );
}

/**
 * Декор вокруг префикса. У каждой темы свой набор и своё поведение:
 * снежинки кружат над текстом, мыши летают вокруг и машут крыльями,
 * искры вспыхивают.
 */
function PrefixOrnaments({ theme }: { theme: SiteTheme }) {
  if (theme === 'newyear') {
    return (
      <>
        <SnowflakeIcon className="prefix-flake prefix-flake-1" />
        <SnowflakeIcon className="prefix-flake prefix-flake-2" />
        <SnowflakeIcon className="prefix-flake prefix-flake-3" />
      </>
    );
  }

  if (theme === 'halloween') {
    return (
      <>
        <BatIcon className="prefix-bat prefix-bat-1" />
        <BatIcon className="prefix-bat prefix-bat-2" />
        <BatIcon className="prefix-bat prefix-bat-3" />
      </>
    );
  }

  return (
    <>
      <span className="prefix-spark prefix-spark-1" aria-hidden />
      <span className="prefix-spark prefix-spark-2" aria-hidden />
      <span className="prefix-spark prefix-spark-3" aria-hidden />
      <span className="prefix-spark prefix-spark-4" aria-hidden />
    </>
  );
}
