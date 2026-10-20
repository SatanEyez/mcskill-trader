import type { ResourceSort } from '../types';

export const SITE_NAME = 'McSkill Trader';
export const SERVER_TAG = 'McSkill · OneBlock';
export const UNCATEGORIZED_LABEL = 'Без категории';

export const SORT_OPTIONS: Array<{ value: ResourceSort; label: string }> = [
  { value: 'name_asc', label: 'По названию' },
  { value: 'price_asc', label: 'Сначала дешёвые' },
  { value: 'price_desc', label: 'Сначала дорогие' },
  { value: 'newest', label: 'Недавно добавленные' },
];

const CATEGORY_STYLES: Record<string, string> = {
  Минералы: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  Редкое: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300',
  Мобы: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  Блоки: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  Еда: 'border-lime-400/20 bg-lime-400/10 text-lime-300',
};

/** Палитра для категорий, созданных администратором. */
const DYNAMIC_CATEGORY_STYLES = [
  'border-sky-400/20 bg-sky-400/10 text-sky-300',
  'border-violet-400/20 bg-violet-400/10 text-violet-300',
  'border-rose-400/20 bg-rose-400/10 text-rose-300',
  'border-teal-400/20 bg-teal-400/10 text-teal-300',
  'border-orange-400/20 bg-orange-400/10 text-orange-300',
  'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
  'border-pink-400/20 bg-pink-400/10 text-pink-300',
  'border-yellow-400/20 bg-yellow-400/10 text-yellow-300',
];

export function categoryStyle(category: string): string {
  if (CATEGORY_STYLES[category]) return CATEGORY_STYLES[category];
  if (category === UNCATEGORIZED_LABEL) {
    return 'border-slate-500/20 bg-slate-500/10 text-slate-400';
  }

  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = (hash + category.charCodeAt(index)) % DYNAMIC_CATEGORY_STYLES.length;
  }

  return DYNAMIC_CATEGORY_STYLES[hash]!;
}
