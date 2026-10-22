import type { SVGProps } from 'react';

/**
 * Иконки новогоднего оформления.
 *
 * Рисуем сами, как и хэллоуинские: спрайт иконок прайса — пиксель-арт 16×16,
 * он не масштабируется до 300 px в фоновом декоре. Здесь вектор, поэтому
 * ёлка одинаково читается и в шапке на 14 px, и в углу экрана.
 */

/** Ёлка с игрушками: декор по краям экрана и метка темы. */
export function TreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden {...props}>
      <rect x="29" y="49" width="6" height="10" rx="1.5" fill="#7c2d12" />
      <path d="M32 30 52 53H12L32 30Z" fill="#166534" />
      <path d="M32 19 47 40H17L32 19Z" fill="#15803d" />
      <path d="M32 9 43 26H21L32 9Z" fill="#16a34a" />
      <path
        d="M32 2.5l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4-4.8-2.9-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5L32 2.5Z"
        fill="#fbbf24"
      />
      <circle cx="26.5" cy="33" r="2" fill="#f87171" />
      <circle cx="38" cy="34" r="2.2" fill="#fbbf24" />
      <circle cx="24" cy="46" r="2.2" fill="#60a5fa" />
      <circle cx="41" cy="47" r="1.9" fill="#f472b6" />
      <circle cx="32" cy="41" r="1.7" fill="#fde68a" />
      <path
        d="M20 53h24M23 40h18M27 26h10"
        stroke="#e0f2fe"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

const SNOWFLAKE_ARMS = [0, 60, 120, 180, 240, 300];

/** Снежинка: шесть лучей с ответвлениями. Цвет — `currentColor`. */
export function SnowflakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden {...props}>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        {SNOWFLAKE_ARMS.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 32 32)`}>
            <path d="M32 32V8" />
            <path d="M32 15.5 27 10.5M32 15.5l5-5" />
            <path d="M32 24.5 28 20.5M32 24.5l4-4" />
          </g>
        ))}
      </g>
      <circle cx="32" cy="32" r="2.6" fill="currentColor" />
    </svg>
  );
}

/** Подарок: декор у ёлок и метка зимней темы. */
export function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden {...props}>
      <rect x="9" y="26" width="46" height="30" rx="3" fill="#b91c1c" />
      <rect x="9" y="26" width="46" height="8" rx="2" fill="#dc2626" />
      <rect x="28" y="26" width="8" height="30" fill="#fbbf24" />
      <path
        d="M32 26c-4-9-14-11-16-5-2 5 6 8 16 5Zm0 0c4-9 14-11 16-5 2 5-6 8-16 5Z"
        fill="#fbbf24"
      />
      <path d="M20 34h8M36 34h8" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/** Месяц: ночное небо зимой вместо хэллоуинской луны. */
export function CrescentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden {...props}>
      <path d="M41 7a25 25 0 1 0 0 50 21 21 0 0 1 0-50Z" fill="currentColor" />
    </svg>
  );
}
