import { Ghost } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { BatIcon, CobwebIcon, PumpkinIcon } from './HalloweenIcons';

/**
 * Фоновый слой сезонного оформления.
 *
 * Слой лежит под контентом (z-0), поэтому не перекрывает текст и формы.
 * Все элементы декоративны и отключены от скринридеров.
 */
export function HalloweenDecor() {
  const { halloween } = useSiteSettings();

  if (!halloween) return null;

  return (
    <div className="halloween-decor pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="halloween-moon" />
      <div className="halloween-glow halloween-glow-left" />
      <div className="halloween-glow halloween-glow-right" />

      <CobwebIcon className="halloween-web halloween-web-left" />
      <CobwebIcon className="halloween-web halloween-web-right" />

      <span className="halloween-star halloween-star-1" />
      <span className="halloween-star halloween-star-2" />
      <span className="halloween-star halloween-star-3" />
      <span className="halloween-star halloween-star-4" />
      <span className="halloween-star halloween-star-5" />
      <span className="halloween-star halloween-star-6" />

      <BatIcon className="halloween-bat halloween-bat-1" />
      <BatIcon className="halloween-bat halloween-bat-2" />
      <BatIcon className="halloween-bat halloween-bat-3" />

      <Ghost className="halloween-ghost halloween-ghost-1" strokeWidth={1.2} />
      <Ghost className="halloween-ghost halloween-ghost-2" strokeWidth={1.2} />

      <PumpkinIcon className="halloween-side-pumpkin halloween-side-pumpkin-left" />
      <PumpkinIcon className="halloween-side-pumpkin halloween-side-pumpkin-right" />

      <span className="halloween-ember halloween-ember-1" />
      <span className="halloween-ember halloween-ember-2" />
      <span className="halloween-ember halloween-ember-3" />
      <span className="halloween-ember halloween-ember-4" />
      <span className="halloween-ember halloween-ember-5" />
      <span className="halloween-ember halloween-ember-6" />

      <div className="halloween-fog" />
    </div>
  );
}
