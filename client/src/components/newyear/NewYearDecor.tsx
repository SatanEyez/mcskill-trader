import { useSiteSettings } from '../../context/SiteSettingsContext';
import { CrescentIcon, GiftIcon, SnowflakeIcon, TreeIcon } from './NewYearIcons';

/**
 * Фоновый слой новогоднего оформления.
 *
 * Устроен как хэллоуинский декор: `fixed inset-0 z-0`, `pointer-events-none`,
 * `aria-hidden` — атмосфера видна в фоне и по краям, но не перекрывает текст,
 * формы и кнопки. Все параметры снега и гирлянды детерминированные: при
 * ререндере снежинки не прыгают на новые места.
 */
export function NewYearDecor() {
  const { newYear } = useSiteSettings();

  if (!newYear) return null;

  return (
    <div className="newyear-decor pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="newyear-glow newyear-glow-left" />
      <div className="newyear-glow newyear-glow-right" />

      <CrescentIcon className="newyear-moon" />

      <div className="newyear-garland">
        <svg className="newyear-wire" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0.4Q50 9.6 100 0.4" fill="none" stroke="currentColor" strokeWidth="0.35" />
        </svg>
        {GARLAND.map((bulb) => (
          <span
            key={bulb.left}
            className="newyear-bulb"
            style={{
              left: `${bulb.left}%`,
              top: `${bulb.top}%`,
              color: bulb.color,
              animationDelay: `${bulb.delay}s`,
            }}
          />
        ))}
      </div>

      <SnowflakeIcon className="newyear-flake newyear-flake-1" />
      <SnowflakeIcon className="newyear-flake newyear-flake-2" />
      <SnowflakeIcon className="newyear-flake newyear-flake-3" />

      <TreeIcon className="newyear-tree newyear-tree-left" />
      <TreeIcon className="newyear-tree newyear-tree-right" />
      <GiftIcon className="newyear-gift newyear-gift-left" />
      <GiftIcon className="newyear-gift newyear-gift-right" />

      {SNOW.map((flake) => (
        <span
          key={flake.id}
          className="newyear-snow"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
          }}
        />
      ))}

      <div className="newyear-snowbank" />
    </div>
  );
}

/**
 * Гирлянда по верхнему краю: цвета чередуются, как на ёлке.
 *
 * `top` считается по параболе — лампочки висят на проводе, который провисает
 * к середине. Провод рисуется той же кривой в SVG, поэтому они совпадают.
 */
const BULB_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#f472b6'];

const GARLAND = Array.from({ length: 26 }, (_, index) => {
  const left = 1.5 + index * 3.85;
  const offset = (left - 50) / 50;

  return {
    left,
    top: Number((offset * offset * 86 + 4).toFixed(1)),
    color: BULB_COLORS[index % BULB_COLORS.length]!,
    delay: Number(((index % 5) * 0.42).toFixed(2)),
  };
});

/**
 * Снегопад: позиция, размер, задержка и скорость считаются от индекса.
 * Детерминированно — иначе после каждого ререндера снежинки телепортировались бы.
 */
const SNOW = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  left: (index * 37 + 11) % 100,
  size: 3 + (index % 4) * 1.8,
  opacity: 0.28 + (index % 5) * 0.1,
  delay: -Number(((index * 1.7) % 16).toFixed(2)),
  duration: 11 + (index % 7) * 2.4,
}));
