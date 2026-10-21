import { Check, Minus } from 'lucide-react';
import clsx from 'clsx';

interface CheckboxProps {
  checked: boolean;
  /** Часть строк выбрана — показываем прочерк вместо галочки. */
  indeterminate?: boolean;
  onChange: () => void;
  /** Подпись для скринридеров и подсказки. */
  label: string;
  className?: string;
}

/**
 * Чекбокс в стиле интерфейса: вместо системного квадрата — мягкая плашка
 * с галочкой. Системные `input[type=checkbox]` на тёмном фоне выглядят
 * как белые квадраты и выбиваются из таблиц.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className,
}: CheckboxProps) {
  const active = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={clsx(
        'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition duration-150',
        active
          ? 'border-accent/60 bg-accent/90 text-[#04110c] shadow-[0_0_0_3px_rgba(52,211,153,0.10)]'
          : 'border-white/15 bg-white/[0.04] text-transparent hover:border-accent/45 hover:bg-white/[0.08]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className,
      )}
    >
      {indeterminate ? (
        <Minus className="h-3 w-3" strokeWidth={3.5} aria-hidden />
      ) : (
        <Check
          className={clsx('h-3 w-3 transition-opacity', checked ? 'opacity-100' : 'opacity-0')}
          strokeWidth={3.5}
          aria-hidden
        />
      )}
    </button>
  );
}
