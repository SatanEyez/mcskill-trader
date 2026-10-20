export type ResourceSort = 'name_asc' | 'price_asc' | 'price_desc' | 'newest';

export interface ResourceRow {
  id: string;
  name: string;
  name_color: string | null;
  min_price: string | number;
  image_url: string;
  category_id: string | null;
  category_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string | number;
}

export interface ResourceDto {
  id: string;
  name: string;
  /** HEX-цвет названия (#RRGGBB) из Minecraft-кодов; null — цвет темы по умолчанию. */
  name_color: string | null;
  min_price: number;
  image_url: string;
  category_id: string | null;
  /** Название категории для отображения. null-категория → «Без категории». */
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ListResourcesQuery {
  search: string;
  category_id?: string;
  sort: ResourceSort;
  page: number;
  limit: number;
}

export interface ResourceInput {
  name: string;
  name_color: string | null;
  min_price: number;
  image_url: string;
  category_id: string | null;
}

export type ResourceUpdate = Partial<ResourceInput>;

export interface ResourceCategoryStat {
  id: string;
  name: string;
  count: number;
}

export interface ResourceStats {
  total: number;
  min_price: number | null;
  avg_price: number | null;
  most_expensive: { name: string; min_price: number } | null;
  categories: ResourceCategoryStat[];
}
