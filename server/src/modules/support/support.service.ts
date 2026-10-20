import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { toIso } from '../../utils/date.js';
import { HttpError } from '../../utils/http-error.js';
import { escapeLike } from '../../utils/sql.js';
import type { AuthPayload } from '../auth/auth.tokens.js';
import type {
  CreateReportInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from './support.schema.js';

export type TicketKind = CreateReportInput['kind'];
export type TicketStatus = 'new' | 'in_progress' | 'answered' | 'closed';

export interface SupportTicketDto {
  id: string;
  ticket_no: number;
  kind: TicketKind;
  nick: string;
  discord: string;
  target: string | null;
  message: string;
  status: TicketStatus;
  admin_reply: string | null;
  replied_by: string | null;
  replied_by_login: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  ip: string | null;
  user_agent: string | null;
}

export interface TicketCounts {
  total: number;
  new: number;
  in_progress: number;
  answered: number;
  closed: number;
}

interface TicketRow {
  id: string;
  ticket_no: number | string;
  kind: TicketKind;
  nick: string;
  discord: string;
  target: string | null;
  message: string;
  status: TicketStatus;
  admin_reply: string | null;
  replied_by: string | null;
  replied_by_login: string | null;
  replied_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  ip: string | null;
  user_agent: string | null;
  total_count?: number | string;
}

function toDto(row: TicketRow): SupportTicketDto {
  return {
    id: row.id,
    ticket_no: Number(row.ticket_no),
    kind: row.kind,
    nick: row.nick,
    discord: row.discord,
    target: row.target,
    message: row.message,
    status: row.status,
    admin_reply: row.admin_reply,
    replied_by: row.replied_by,
    replied_by_login: row.replied_by_login,
    replied_at: row.replied_at ? toIso(row.replied_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    ip: row.ip,
    user_agent: row.user_agent,
  };
}

export async function createTicket(
  input: CreateReportInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<SupportTicketDto> {
  const db = await getDb();
  const result = await db.query<TicketRow>(
    `INSERT INTO support_tickets
       (id, kind, nick, discord, target, message, status, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.kind,
      input.nick,
      input.discord,
      input.target || null,
      input.message,
      meta.ip,
      meta.userAgent,
    ],
  );

  return toDto(result.rows[0]!);
}

export interface TicketListResult {
  data: SupportTicketDto[];
  total: number;
}

export async function listTickets(query: ListTicketsQuery): Promise<TicketListResult> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    params.push(query.status);
    conditions.push(`status = $${params.length}`);
  }

  if (query.kind) {
    params.push(query.kind);
    conditions.push(`kind = $${params.length}`);
  }

  if (query.search) {
    params.push(`%${escapeLike(query.search)}%`);
    const position = params.length;
    conditions.push(
      `(nick ILIKE $${position} ESCAPE '!' OR discord ILIKE $${position} ESCAPE '!' ` +
        `OR message ILIKE $${position} ESCAPE '!' OR target ILIKE $${position} ESCAPE '!')`,
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(query.limit);
  const limitPosition = params.length;
  params.push(query.offset);
  const offsetPosition = params.length;

  const result = await db.query<TicketRow>(
    `SELECT *, COUNT(*) OVER() AS total_count
       FROM support_tickets
       ${whereSql}
      ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
               created_at DESC
      LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
    params,
  );

  return {
    data: result.rows.map(toDto),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

export async function getTicketCounts(): Promise<TicketCounts> {
  const db = await getDb();
  const result = await db.query<TicketCounts>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'new')::int AS new,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'answered')::int AS answered,
            COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
       FROM support_tickets`,
  );

  const row = result.rows[0];

  return {
    total: Number(row?.total ?? 0),
    new: Number(row?.new ?? 0),
    in_progress: Number(row?.in_progress ?? 0),
    answered: Number(row?.answered ?? 0),
    closed: Number(row?.closed ?? 0),
  };
}

export async function getTicket(id: string): Promise<SupportTicketDto> {
  const db = await getDb();
  const result = await db.query<TicketRow>('SELECT * FROM support_tickets WHERE id = $1', [id]);
  const row = result.rows[0];

  if (!row) throw new HttpError(404, 'Обращение не найдено');

  return toDto(row);
}

export interface TicketUpdateResult {
  data: SupportTicketDto;
  previous: SupportTicketDto;
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  actor: AuthPayload,
): Promise<TicketUpdateResult> {
  const previous = await getTicket(id);

  const hasReply = input.admin_reply !== undefined && input.admin_reply.length > 0;
  const status =
    input.status ?? (hasReply && previous.status === 'new' ? 'answered' : previous.status);

  const db = await getDb();
  await db.query(
    `UPDATE support_tickets
        SET status = $2,
            admin_reply = $3,
            replied_by = CASE WHEN $4 THEN $5 ELSE replied_by END,
            replied_by_login = CASE WHEN $4 THEN $6 ELSE replied_by_login END,
            replied_at = CASE WHEN $4 THEN NOW() ELSE replied_at END,
            updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      status,
      input.admin_reply !== undefined ? input.admin_reply || null : previous.admin_reply,
      hasReply,
      actor.sub,
      actor.login,
    ],
  );

  return { data: await getTicket(id), previous };
}
