import type { SVGProps } from 'react';

/** Тыква-фонарь: используется в шапке, подвале и админке. */
export function PumpkinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden {...props}>
      <path
        d="M32 9c-2.7 0-4.6 1.9-5.1 4.8-.4 2.2-.1 4.3.7 6.3"
        stroke="#65a30d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M31.8 14.6c-8.1-1.8-16.1 1.8-19.2 9.1-2.7 6.5-.2 14.4 6 19.8 3.2 2.8 7.4 4.7 13.4 5.7 6-1 10.2-2.9 13.4-5.7 6.2-5.4 8.7-13.3 6-19.8-3.1-7.3-11.1-10.9-19.2-9.1Z"
        fill="#ea580c"
      />
      <path
        d="M32 15.4c-4.7 0-8.4 6.5-8.4 14.7S27.3 44.8 32 44.8s8.4-6.5 8.4-14.7S36.7 15.4 32 15.4Z"
        fill="#fb923c"
      />
      <path
        d="M25.2 28.2l4.4 3.4-4.4 1.5M38.8 28.2l-4.4 3.4 4.4 1.5"
        stroke="#431407"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26.2 37.2l2.6 3 3.2-3 3.2 3 2.6-3"
        stroke="#431407"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Силуэт летучей мыши для фонового слоя. */
export function BatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 32" fill="none" aria-hidden {...props}>
      <path
        d="M32 7c2.1 0 3.8 1.9 4.8 4.8 5.8-4.7 13.5-6.4 22.2-4-5.1 2.1-8.7 5.8-9.8 11.2 5.7-1.8 10.5-.4 14.8 4.1-7.4.1-12.2 2.5-14.5 7.3-6-5-12.3-6.9-17.5-5.3-5.2-1.6-11.5.3-17.5 5.3C12.2 25.6 7.4 23.2 0 23.1c4.3-4.5 9.1-5.9 14.8-4.1C13.6 13.6 10 9.9 4.9 7.8c8.7-2.4 16.4-.7 22.2 4C28.2 8.9 29.9 7 32 7Z"
        fill="currentColor"
      />
      <path d="M28.6 8.4 26.4 4l4.2 2.1L32 2l1.4 4.1L37.6 4l-2.2 4.4" fill="currentColor" />
    </svg>
  );
}

/** Паутина для углов экрана и превью в админке. */
export function CobwebIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden {...props}>
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M2 2 116 2M2 2 2 116M2 2 112 108M2 2 78 118M2 2 118 78" />
        <path d="M2 2c5 30 26 55 58 66M2 2c30 5 55 26 66 58M2 2c45 3 76 34 82 82M2 2c3 45 34 76 82 82" opacity=".7" />
        <path d="M30 2c2 13 10 22 24 25M2 30c13 2 22 10 25 24M63 2c2 22 17 37 39 39M2 63c22 2 37 17 39 39M94 2c1 35 23 57 24 58M2 94c35 1 57 23 58 24" opacity=".5" />
      </g>
    </svg>
  );
}
