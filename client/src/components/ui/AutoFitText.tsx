import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

interface AutoFitTextProps {
  children: ReactNode;
  /** Максимальный размер шрифта в px. */
  max?: number;
  /** Минимальный размер шрифта в px — меньше уже нечитаемо. */
  min?: number;
  className?: string;
  title?: string;
}

/**
 * Текст, который уменьшает размер шрифта, пока не влезет в контейнер.
 *
 * Нужен для длинных сумм в трейд-калькуляторе: «18.492.283.542.331,51»
 * не должно вылезать за карточку. Цифры не сокращаем — уменьшаем только
 * размер, привязанный к реальной ширине родителя (через ResizeObserver).
 */
export function AutoFitText({ children, max = 24, min = 9, className, title }: AutoFitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const lastWidth = useRef(-1);

  const fit = useCallback(
    (force = false) => {
      const element = ref.current;

      if (!element) return;

      const width = element.clientWidth;

      // Ширина не изменилась — пересчитывать нечего (заодно защита от петли
      // ResizeObserver: мы меняем только высоту, а не ширину).
      if (!force && width > 0 && width === lastWidth.current) return;

      lastWidth.current = width;

      let size = max;
      element.style.fontSize = `${size}px`;

      // Шаг 0,5 px: подбираем размер точнее, чтобы не оставалось «хвоста» в пару пикселей.
      while (size > min && element.scrollWidth > element.clientWidth + 0.5) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    },
    [max, min],
  );

  useLayoutEffect(() => {
    lastWidth.current = -1;
    fit(true);

    const parent = ref.current?.parentElement;
    const observer = new ResizeObserver(() => fit());

    if (parent) observer.observe(parent);

    return () => observer.disconnect();
  }, [fit, children]);

  return (
    <span ref={ref} className={clsx('block w-full whitespace-nowrap', className)} title={title}>
      {children}
    </span>
  );
}
