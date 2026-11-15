import { isValidInitials } from '../../src/app/blocklist';
import { MAX_LOG_BYTES, validateSubmission } from './validate';

export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
}
export interface Env {
  DB: D1Like;
  SALT?: string;
}

const RATE_LIMIT = 50;

export const SQL_RATE =
  'INSERT INTO submissions (day, ip_hash, count) VALUES (?, ?, 1) ' +
  'ON CONFLICT(day, ip_hash) DO UPDATE SET count = count + 1 RETURNING count';

export const SQL_INSERT =
  'INSERT INTO scores (day, initials, time_ms, points, closes, input_log, ip_hash, created_at) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

export const SQL_RANK =
  'SELECT COUNT(*) AS n FROM scores WHERE (time_ms > ? OR ' +
  '(time_ms = ? AND points > ?) OR (time_ms = ? AND points = ? AND created_at < ?))';

export const SQL_TOP =
  'SELECT initials, time_ms, points FROM scores ' +
  'ORDER BY time_ms DESC, points DESC, created_at ASC LIMIT 10';

export const SQL_ME =
  'SELECT initials, time_ms, points, created_at FROM scores WHERE initials = ? ' +
  'ORDER BY time_ms DESC, points DESC, created_at ASC LIMIT 1';

interface ScoreRow {
  initials: string;
  time_ms: number;
  points: number;
  created_at: number;
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const todayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

async function rankOf(db: D1Like, r: { time_ms: number; points: number; created_at: number }) {
  const c = await db
    .prepare(SQL_RANK)
    .bind(r.time_ms, r.time_ms, r.points, r.time_ms, r.points, r.created_at)
    .first<{ n: number }>();
  return 1 + (c?.n ?? 0);
}

async function postScore(req: Request, env: Env, now: number): Promise<Response> {
  if (Number(req.headers.get('content-length') ?? 0) > 2 * MAX_LOG_BYTES) return json({ error: 'too big' }, 413);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const v = validateSubmission(body, todayOf(now));
  if (!v.ok) return json({ error: v.error }, 400);
  const s = v.value;

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await sha256Hex(ip + s.day + (env.SALT ?? 'upp-local-salt'));

  const sub = await env.DB.prepare(SQL_RATE).bind(s.day, ipHash).first<{ count: number }>();
  if ((sub?.count ?? 0) > RATE_LIMIT) return json({ error: 'rate limited' }, 429);

  await env.DB.prepare(SQL_INSERT)
    .bind(s.day, s.initials, s.timeMs, s.points, s.closes, JSON.stringify(s.inputLog), ipHash, now)
    .run();

  const rank = await rankOf(env.DB, { time_ms: s.timeMs, points: s.points, created_at: now });
  return json({ rank }, 201);
}

async function getScores(url: URL, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(SQL_TOP).all<ScoreRow>();
  const top = rows.results.map((r, i) => ({
    rank: i + 1,
    initials: r.initials,
    timeMs: r.time_ms,
    points: r.points,
  }));

  let me: { rank: number; initials: string; timeMs: number; points: number } | null = null;
  const meParam = url.searchParams.get('me') ?? '';
  if (isValidInitials(meParam)) {
    const r = await env.DB.prepare(SQL_ME).bind(meParam).first<ScoreRow>();
    if (r) {
      me = { rank: await rankOf(env.DB, r),initials: r.initials, timeMs: r.time_ms, points: r.points };
    }
  }
  return json({ top, me }, 200, { 'Cache-Control': 'no-store' });
}

export async function handle(req: Request, env: Env, now: number): Promise<Response> {
  const url = new URL(req.url);
  try {
    if (url.pathname === '/api/score' && req.method === 'POST') return await postScore(req, env, now);
    if (url.pathname === '/api/scores' && req.method === 'GET') return await getScores(url, env);
  } catch {
    return json({ error: 'server error' }, 500);
  }
  return json({ error: 'not found' }, 404);
}
