import { useEffect, useRef, type ClipboardEvent } from 'react';
import { Bold, Eraser, Italic, Underline } from 'lucide-react';
import clsx from 'clsx';
import { looksLikeHtml, plainTextToHtml } from '../../lib/news-html';

/** Шрифты, которые можно применить к выделенному тексту новости. */
const FONTS = [
  { value: '', label: 'Обычный' },
  { value: "'Unbounded', 'Inter', sans-serif", label: 'Unbounded — заголовочный' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter — основной' },
  { value: 'Georgia, "Times New Roman", serif', label: 'С засечками' },
  { value: 'ui-monospace, "JetBrains Mono", monospace', label: 'Моноширинный' },
];

/** Палитра цветов текста: базовая + акценты сайта. */
const COLORS = ['#E2E8F0', '#34D399', '#FBBF24', '#F87171', '#60A5FA', '#A78BFA'];

interface NewsEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Редактор текста новости: шрифт, цвет, жирный/курсив/подчёркивание.
 *
 * Хранит HTML в том же поле `body`, что и раньше: старые новости остаются
 * простым текстом и открываются как обычно.
 */
export function NewsEditor({ id, value, onChange, placeholder }: NewsEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Внешнее значение (открыли другую новость) — перерисовываем содержимое.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const html = looksLikeHtml(value) ? value : plainTextToHtml(value);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [value]);

  const saveSelection = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;

    if (!selection || selection.rangeCount === 0 || !editor) return;
    if (!editor.contains(selection.anchorNode)) return;

    savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const range = savedRange.current;
    if (!range) return;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const run = (command: string, argument?: string) => {
    restoreSelection();
    // styleWithCSS заставляет браузер писать style="", а не устаревшие <font>.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, argument);
    saveSelection();
    emitChange();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    // Вставляем только текст: чужая разметка в новости не нужна.
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emitChange();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] focus-within:border-accent/40">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
        onMouseDown={(event) => {
          // Кнопки не должны забирать фокус у редактора — иначе теряется выделение.
          if ((event.target as HTMLElement).tagName !== 'SELECT') event.preventDefault();
        }}
      >
        <select
          aria-label="Шрифт"
          defaultValue=""
          onChange={(event) => run('fontName', event.target.value || 'inherit')}
          className="h-7 rounded-lg border border-white/[0.08] bg-panel px-1.5 text-[11px] text-slate-300 outline-none transition hover:border-accent/30"
        >
          {FONTS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-white/[0.08]" aria-hidden />

        {[
          { command: 'bold', icon: Bold, label: 'Жирный' },
          { command: 'italic', icon: Italic, label: 'Курсив' },
          { command: 'underline', icon: Underline, label: 'Подчёркнутый' },
        ].map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            onClick={() => run(command)}
            title={label}
            aria-label={label}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-white/[0.08]" aria-hidden />

        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => run('foreColor', color)}
              title={`Цвет текста ${color}`}
              aria-label={`Цвет текста ${color}`}
              className="h-5 w-5 rounded-full border border-white/20 transition hover:scale-110 hover:border-white/50"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <span className="mx-1 h-5 w-px bg-white/[0.08]" aria-hidden />

        <button
          type="button"
          onClick={() => run('removeFormat')}
          title="Убрать форматирование"
          aria-label="Убрать форматирование"
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden />
        </button>

        <span className="ml-auto hidden text-[10px] text-slate-600 sm:block">
          выделите текст и выберите шрифт или цвет
        </span>
      </div>

      <div
        id={id}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? 'Что изменилось и с какого момента…'}
        onInput={emitChange}
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onPaste={handlePaste}
        className={clsx(
          'min-h-[220px] px-3.5 py-3 text-sm leading-relaxed text-slate-200 outline-none',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white',
          '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400',
        )}
      />
    </div>
  );
}
