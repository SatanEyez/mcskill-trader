export type VisitPeriod = '24h' | '7d' | '30d' | 'all';

export interface VisitSeriesPoint {
  /** Ключ бакета: `2026-10-21` или `2026-10-21 15:00` (уже по Москве). */
  bucket: string;
  visits: number;
  visitors: number;
}

export interface VisitPageStat {
  path: string;
  visits: number;
}

export interface VisitStatsDto {
  period: VisitPeriod;
  /** Просмотры страниц за период. */
  visits: number;
  /** Уникальные посетители за период (по cookie). */
  visitors: number;
  /** Из них те, кто зашёл впервые именно в этом периоде. */
  new_visitors: number;
  /** Посетители, которые уже заходили раньше. */
  returning_visitors: number;
  /** Уникальные посетители за последние 5 минут. */
  online_now: number;
  /** Всего за всё время — для контекста. */
  total_visits: number;
  total_visitors: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  series: VisitSeriesPoint[];
  pages: VisitPageStat[];
}

export interface VisitorEntry {
  /** Короткий идентификатор посетителя (cookie), не логин. */
  id: string;
  visits: number;
  first_seen: string;
  last_seen: string;
  last_path: string;
}

export interface VisitorsListResult {
  data: VisitorEntry[];
  total: number;
}

export interface VisitRow {
  visits: number | string;
  visitors: number | string;
  first_visit_at: Date | string | null;
  last_visit_at: Date | string | null;
}

export interface SeriesRow {
  bucket: string;
  visits: number | string;
  visitors: number | string;
}

export interface VisitorRow {
  visitor_id: string;
  visits: number | string;
  first_seen: Date | string;
  last_seen: Date | string;
  last_path: string;
}
