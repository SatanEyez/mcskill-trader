export interface NewsPostDto {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_published: boolean;
  views: number;
  created_by_login: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface NewsRow {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_published: number | boolean;
  views: number | string;
  created_by_login: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
  total_count?: number | string;
}

export interface NewsListResult {
  data: NewsPostDto[];
  total: number;
}
