import { useEffect, useState } from 'react';
import { PackageOpen } from 'lucide-react';
import clsx from 'clsx';

interface ItemImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/**
 * Иконка предмета с аккуратным фолбэком: если ссылка битая,
 * показываем нейтральный плейсхолдер вместо «сломанной» картинки.
 */
export function ItemImage({ src, alt, className, eager = false }: ItemImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={clsx('grid place-items-center', className)} role="img" aria-label={alt}>
        <PackageOpen className="h-1/2 w-1/2 text-slate-600" aria-hidden />
      </span>
    );
  }

  return (
    <span className={clsx('grid place-items-center', className)}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="pixelated h-full w-full object-contain"
      />
    </span>
  );
}
