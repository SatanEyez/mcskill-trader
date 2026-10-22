import type { Resource } from '../types';

export interface CategoryOption {
  id: string;
  name: string;
}

/** Ключ категории «без категории» в фильтрах. */
export const NO_CATEGORY_KEY = 'none';

/**
 * Собирает категории, которые реально встречаются в наборе ресурсов.
 *
 * Нужно там, где полный список категорий не запрашивается: в пикере предметов
 * и в обменнике достаточно тех, что есть в каталоге. Ресурсы без категории
 * попадают под ключ `none`.
 */
export function collectCategories(resources: Resource[]): CategoryOption[] {
  const map = new Map<string, string>();

  for (const resource of resources) {
    const key = resource.category_id ?? NO_CATEGORY_KEY;
    if (!map.has(key)) map.set(key, resource.category);
  }

  return Array.from(map, ([id, name]) => ({ id, name })).sort((left, right) =>
    left.name.localeCompare(right.name, 'ru'),
  );
}

/** Оставляет ресурсы выбранной категории; `null` — все. */
export function filterByCategory(
  resources: Resource[],
  categoryId: string | null,
): Resource[] {
  if (!categoryId) return resources;

  if (categoryId === NO_CATEGORY_KEY) {
    return resources.filter((resource) => resource.category_id === null);
  }

  return resources.filter((resource) => resource.category_id === categoryId);
}
