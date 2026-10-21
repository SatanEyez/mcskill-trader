import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { MAX_TRADE_COINS, clampCoins } from '../../lib/trade';
import { formatPriceDots } from '../../lib/format';

interface CoinInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** «1.234,56», «1234,56», «1234.56», «1 234.56» → число. */
export function parseCoinsInput(text: string): number {
  // Разрешаем только цифры и разделители: буквы и прочий мусор просто отбрасываем.
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (cleaned === '') return 0;

  let normalized: string;

  if (cleaned.includes(',')) {
    // Запятая — дробный разделитель, точки — разряды.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // «1.234» и «1.234.567» — это разряды, а не дробь.
    normalized = cleaned.replace(/\./g, '');
  } else {
    normalized = cleaned;
  }

  if (!/^\d*\.?\d*$/.test(normalized)) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? clampCoins(parsed) : 0;
}

const MAX_INPUT_LENGTH = 24;

export function CoinInput({ value, onChange, className }: CoinInputProps) {
  const inputId = useId();
  const [text, setText] = useState(() => (value > 0 ? formatPriceDots(value) : ''));
  const focusedRef = useRef(false);

  // Внешние изменения (очистка сделки, «минка к минке», соседняя вкладка)
  // подхватываем, только пока поле не в фокусе — иначе курсор прыгает.
  useEffect(() => {
    if (!focusedRef.current) setText(value > 0 ? formatPriceDots(value) : '');
  }, [value]);

  const handleBlur = () => {
    focusedRef.current = false;
    setText(value > 0 ? formatPriceDots(value) : '');
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition focus-within:border-amber-400/40 focus-within:bg-amber-400/[0.04]',
        className,
      )}
    >
      <img
        src="/coin.png"
        alt=""
        width={16}
        height={16}
        className="pixelated h-4 w-4 shrink-0"
        aria-hidden
      />

      <label htmlFor={inputId} className="shrink-0 text-[11px] font-medium text-slate-400">
        Монеты
      </label>

      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={text}
        maxLength={MAX_INPUT_LENGTH}
        placeholder="0"
        aria-label="Монеты к этой стороне сделки"
        title={`Монеты, которые сторона добавляет к предметам. Максимум — ${formatPriceDots(MAX_TRADE_COINS)}`}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={handleBlur}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,]/g, '');
          setText(next);
          onChange(parseCoinsInput(next));
        }}
        className="min-w-0 flex-1 bg-transparent text-right font-display text-sm font-semibold text-white outline-none placeholder:font-sans placeholder:text-slate-600"
      />

      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          title="Убрать монеты"
          aria-label="Убрать монеты"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
