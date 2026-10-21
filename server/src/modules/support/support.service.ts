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
  const id = randomUUID();

  await db.query(
    `INSERT INTO support_tickets
       (id, kind, nick, discord, target, message, status, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    [
      id,
      input.kind,
      input.nick,
      input.discord,
      input.target || null,
      input.message,
      meta.ip,
      meta.userAgent,
    ],
  );

  return getTicket(id);
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
    conditions.push('status = ?');
  }

  if (query.kind) {
    params.push(query.kind);
    conditions.push('kind = ?');
  }

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    params.push(pattern, pattern, pattern, pattern);
    conditions.push(
      "(nick LIKE ? ESCAPE '!' OR discord LIKE ? ESCAPE '!' " +
        "OR message LIKE ? ESCAPE '!' OR target LIKE ? ESCAPE '!')",
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(query.limit, query.offset);

  const result = await db.query<TicketRow>(
    `SELECT *, COUNT(*) OVER() AS total_count
       FROM support_tickets
       ${whereSql}
      ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
               created_at DESC
      LIMIT ? OFFSET ?`,
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
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN status = 'new' THEN 1 END) AS new,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
            COUNT(CASE WHEN status = 'answered' THEN 1 END) AS answered,
            COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed
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
  const result = await db.query<TicketRow>('SELECT * FROM support_tickets WHERE id = ?', [id]);
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
        SET status = ?,
            admin_reply = ?,
            replied_by = CASE WHEN ? THEN ? ELSE replied_by END,
            replied_by_login = CASE WHEN ? THEN ? ELSE replied_by_login END,
            replied_at = CASE WHEN ? THEN CURRENT_TIMESTAMP(3) ELSE replied_at END,
            updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [
      status,
      input.admin_reply !== undefined ? input.admin_reply || null : previous.admin_reply,
      hasReply,
      actor.sub,
      hasReply,
      actor.login,
      hasReply,
      id,
    ],
  );

  return { data: await getTicket(id), previous };
}
