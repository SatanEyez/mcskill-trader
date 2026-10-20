export interface CategoryRow {
  id: string;
  name: string;
  resource_count?: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CategoryDto {
  id: string;
  name: string;
  resource_count: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryInput {
  name: string;
}
