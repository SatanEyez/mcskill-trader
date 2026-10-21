import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { isProduction } from '../../config/env.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as statsService from './stats.service.js';
import type { TrackVisitInput, VisitorsQuery, VisitStatsQuery } from './stats.schema.js';

/** Долгоживущая cookie посетителя: по ней считаются уникальные люди. */
export const VISITOR_COOKIE = 'mcskill_visitor';
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Поисковики, мониторы и скрипты не должны попадать в статистику:
 * иначе «посещения» растут от ботов, а не от людей.
 */
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|headless|phantom|python-requests|python-urllib|curl|wget|node-fetch|axios|go-http-client|java\/|okhttp|monitor|uptime|pingdom|lighthouse|pagespeed|facebookexternalhit|telegrambot|whatsapp|discordbot|preview/i;

export function isBotUserAgent(userAgent: string): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}

export const trackVisit: RequestHandler = asyncHandler(async (req, res) => {
  const userAgent = req.get('user-agent') ?? '';

  // Ботов просто не записываем — статистика должна отражать людей.
  if (isBotUserAgent(userAgent)) {
    res.status(204).end();
    return;
  }

  const input = req.validatedBody as TrackVisitInput;

  let visitorId = readCookie(req, VISITOR_COOKIE);

  if (!visitorId || !UUID_RE.test(visitorId)) {
    visitorId = randomUUID();

    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  await statsService.recordVisit(visitorId, input, {
    ip: req.ip ?? null,
    userAgent,
    referrer: input.referrer || req.get('referer') || null,
  });

  res.status(204).end();
});

export const getVisitStats: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as VisitStatsQuery;
  res.json({ data: await statsService.getVisitStats(query.period) });
});

export const listVisitors: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as VisitorsQuery;
  const result = await statsService.listVisitors(query);

  res.json({
    data: result.data,
    meta: { total: result.total, count: result.data.length, limit: query.limit, offset: query.offset },
  });
});
