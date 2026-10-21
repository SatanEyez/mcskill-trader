import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import type {
  SeriesRow,
  VisitPageStat,
  VisitPeriod,
  VisitorEntry,
  VisitorRow,
  VisitRow,
  VisitSeriesPoint,
  VisitStatsDto,
  VisitorsListResult,
} from './stats.types.js';
import type { TrackVisitInput, VisitorsQuery } from './stats.schema.js';

/** Горизонт «онлайн» — посетитель считается на сайте 5 минут после просмотра. */
export const ONLINE_WINDOW_MINUTES = 5;

/** Разбивка по суткам идёт по Москве, как и весь остальной интерфейс. */
const MSK_SHIFT = 'INTERVAL 3 HOUR';

const PERIOD_HOURS: Record<Exclude<VisitPeriod, 'all'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

function periodSince(period: VisitPeriod): Date | null {
  if (period === 'all') return null;
  return new Date(Date.now() - PERIOD_HOURS[period] * 60 * 60 * 1000);
}

export interface VisitMeta {
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
}

/**
 * Записывает один просмотр страницы.
 * visitor_id — долгоживущая cookie: по ней считается число разных людей.
 */
export async function recordVisit(
  visitorId: string,
  input: TrackVisitInput,
  meta: VisitMeta,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO site_visits (visitor_id, path, referrer, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [
      visitorId,
      input.path || '/',
      meta.referrer ? meta.referrer.slice(0, 255) : null,
      meta.ip ? meta.ip.slice(0, 64) : null,
      meta.userAgent ? meta.userAgent.slice(0, 255) : null,
    ],
  );
}

export async function getVisitStats(period: VisitPeriod): Promise<VisitStatsDto> {
  const db = await getDb();
  const since = periodSince(period);

  const whereSql = since ? 'WHERE created_at >= ?' : '';
  const whereParams: unknown[] = since ? [since] : [];

  const totals = await db.query<VisitRow>(
    `SELECT COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS visitors,
            MIN(created_at) AS first_visit_at,
            MAX(created_at) AS last_visit_at
       FROM site_visits
       ${whereSql}`,
    whereParams,
  );

  const row = totals.rows[0];
  const visits = Number(row?.visits ?? 0);
  const visitors = Number(row?.visitors ?? 0);

  // «Новые» — те, чей самый первый визит попал в выбранный период.
  let newVisitors = visitors;

  if (since) {
    const fresh = await db.query<{ n: number | string }>(
      `SELECT COUNT(*) AS n
         FROM (SELECT visitor_id, MIN(created_at) AS first_seen
                 FROM site_visits
                GROUP BY visitor_id) AS firsts
        WHERE firsts.first_seen >= ?`,
      [since],
    );
    newVisitors = Number(fresh.rows[0]?.n ?? 0);
  }

  const online = await db.query<{ n: number | string }>(
    `SELECT COUNT(DISTINCT visitor_id) AS n
       FROM site_visits
      WHERE created_at >= CURRENT_TIMESTAMP(3) - INTERVAL ${ONLINE_WINDOW_MINUTES} MINUTE`,
  );

  const allTime = await db.query<{ visits: number | string; visitors: number | string }>(
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors FROM site_visits`,
  );

  const bucketFormat = period === '24h' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
  const seriesSince = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const series = await db.query<SeriesRow>(
    `SELECT DATE_FORMAT(created_at + ${MSK_SHIFT}, '${bucketFormat}') AS bucket,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS visitors
       FROM site_visits
      WHERE created_at >= ?
      GROUP BY bucket
      ORDER BY bucket ASC`,
    [seriesSince],
  );

  const pages = await db.query<{ path: string; visits: number | string }>(
    `SELECT path, COUNT(*) AS visits
       FROM site_visits
       ${whereSql}
      GROUP BY path
      ORDER BY visits DESC
      LIMIT 8`,
    whereParams,
  );

  return {
    period,
    visits,
    visitors,
    new_visitors: newVisitors,
    returning_visitors: Math.max(0, visitors - newVisitors),
    online_now: Number(online.rows[0]?.n ?? 0),
    total_visits: Number(allTime.rows[0]?.visits ?? 0),
    total_visitors: Number(allTime.rows[0]?.visitors ?? 0),
    first_visit_at: row?.first_visit_at ? toIso(row.first_visit_at) : null,
    last_visit_at: row?.last_visit_at ? toIso(row.last_visit_at) : null,
    series: series.rows.map<VisitSeriesPoint>((entry) => ({
      bucket: entry.bucket,
      visits: Number(entry.visits),
      visitors: Number(entry.visitors),
    })),
    pages: pages.rows.map<VisitPageStat>((entry) => ({
      path: entry.path,
      visits: Number(entry.visits),
    })),
  };
}

/**
 * Список реальных посетителей: у каждого — сколько раз заходил,
 * когда впервые и когда последний раз, какая страница была последней.
 */
export async function listVisitors(query: VisitorsQuery): Promise<VisitorsListResult> {
  const db = await getDb();

  const totalResult = await db.query<{ total: number | string }>(
    'SELECT COUNT(DISTINCT visitor_id) AS total FROM site_visits',
  );

  const result = await db.query<VisitorRow>(
    `SELECT visitor_id,
            visits,
            first_seen,
            last_seen,
            last_path
       FROM (
         SELECT visitor_id,
                path AS last_path,
                COUNT(*) OVER (PARTITION BY visitor_id) AS visits,
                MIN(created_at) OVER (PARTITION BY visitor_id) AS first_seen,
                MAX(created_at) OVER (PARTITION BY visitor_id) AS last_seen,
                ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY created_at DESC, id DESC) AS rn
           FROM site_visits
       ) AS ranked
      WHERE rn = 1
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?`,
    [query.limit, query.offset],
  );

  return {
    data: result.rows.map<VisitorEntry>((entry) => ({
      id: entry.visitor_id,
      visits: Number(entry.visits),
      first_seen: toIso(entry.first_seen),
      last_seen: toIso(entry.last_seen),
      last_path: entry.last_path,
    })),
    total: Number(totalResult.rows[0]?.total ?? 0),
  };
}
