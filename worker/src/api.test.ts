import { describe, expect, it } from 'vitest';
import { handle, type D1Like, type D1Stmt, type Env } from './api';

interface Row {
  day: string;
  initials: string;
  time_ms: number;
  points: number;
  closes: number;
  input_log: string;
  ip_hash: string;
  created_at: number;
}

const better = (a: Row, b: Row) =>
  b.time_ms - a.time_ms || b.points - a.points || a.created_at - b.created_at;

function fakeDb() {
  const scores: Row[] = [];
  const subs = new Map<string, number>();

  const run = (sql: string, v: unknown[]): unknown => {
    if (sql.includes('INTO submissions')) {
      const k = `${v[0]}|${v[1]}`;
      const n = (subs.get(k) ?? 0) + 1;
      subs.set(k, n);
      return { count: n };
    }
    if (sql.includes('INTO scores')) {
      const [day, initials, time_ms, points, closes, input_log, ip_hash, created_at] = v as [
        string, string, number, number, number, string, string, number,
      ];
      scores.push({ day, initials, time_ms, points, closes, input_log, ip_hash, created_at });
      return null;
    }
    if (sql.includes('COUNT(*)')) {
      const [t1, t2, p2, t3, p3, c3] = v as [number, number, number, number, number, number];
      const n = scores.filter(
        (r) => r.time_ms > t1 || (r.time_ms === t2 && r.points > p2) || (r.time_ms === t3 && r.points === p3 && r.created_at < c3),
      ).length;
      return { n };
    }
    if (sql.includes('LIMIT 10') && !sql.includes('WHERE')) {
      return [...scores].sort(better).slice(0, 10);
    }
    if (sql.includes('WHERE initials = ?')) {
      return [...scores].filter((r) => r.initials === v[0]).sort(better)[0] ?? null;
    }
    throw new Error('unexpected sql: ' + sql);
  };

  const db: D1Like = {
    prepare(sql: string): D1Stmt {
      let v: unknown[] = [];
      const st: D1Stmt = {
        bind(...a) { v = a; return st; },
        async first<T>() { return run(sql, v) as T | null; },
        async all<T>() { return { results: run(sql, v) as T[] }; },
        async run() { run(sql, v); return {}; },
      };
      return st;
    },
  };
  return { db, scores, subs };
}

const NOW = Date.UTC(2026, 10, 15, 12);
const DAY = '2026-11-15';

function body(over: Record<string, unknown> = {}) {
  return {
    initials: 'NAD', timeMs: 10000, points: 16, closes: 3,
    inputLog: [[0, 'pointer', 1, 2], [300], [600]],
    ...over,
  };
}

function post(env: Env, b: unknown, ip: string, now = NOW) {
  return handle(
    new Request('http://x/api/score', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': ip },
      body: typeof b === 'string' ? b : JSON.stringify(b),
    }),
    env,
    now,
  );
}

const get = (env: Env, qs: string) => handle(new Request('http://x/api/scores' + qs), env, NOW);

type Top = { top: { initials: string; rank: number; timeMs: number }[]; me: { rank: number; initials: string } | null };

describe('POST /api/score', () => {
  it('ranks three players by time then points', async () => {
    const { db } = fakeDb();
    const env: Env = { DB: db };
    const a = await post(env, body({ initials: 'AAA', timeMs: 10000 }), '1.1.1.1', NOW);
    expect(a.status).toBe(201);
    expect(a.headers.get('content-type')).toContain('application/json');
    expect(await a.json()).toEqual({ rank: 1 });
    const b = await post(env, body({ initials: 'BBB', timeMs: 20000, inputLog: [[0], [1], [1200]] }), '2.2.2.2', NOW + 1);
    expect(await b.json()).toEqual({ rank: 1 });
    const c = await post(env, body({ initials: 'CCC', timeMs: 10000, points: 24 }), '3.3.3.3', NOW + 2);
    expect(await c.json()).toEqual({ rank: 2 });
    const top = (await (await get(env, '')).json()) as Top;
    expect(top.top.map((t) => t.initials)).toEqual(['BBB', 'CCC', 'AAA']);
  });

  it('accepts a submission without day, stamping the server UTC day', async () => {
    const { db, scores } = fakeDb();
    const r = await post({ DB: db }, body(), '1.1.1.1');
    expect(r.status).toBe(201);
    expect(scores[0]!.day).toBe(DAY);
  });

  it('accepts and ignores a stale client day', async () => {
    const { db, scores } = fakeDb();
    const r = await post({ DB: db }, body({ day: '2026-01-01' }), '1.1.1.1');
    expect(r.status).toBe(201);
    expect(scores).toHaveLength(1);
    expect(scores[0]!.day).toBe(DAY);
  });

  it('stores every run: same initials and ip twice, both can be in the top', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    await post(env, body({ timeMs: 10000 }), '1.1.1.1', NOW);
    const worse = await post(env, body({ timeMs: 5000 }), '1.1.1.1', NOW + 1);
    expect(worse.status).toBe(201);
    expect(await worse.json()).toEqual({ rank: 2 });
    expect(scores).toHaveLength(2);
    const top = (await (await get(env, '')).json()) as Top;
    expect(top.top.map((t) => [t.initials, t.timeMs])).toEqual([['NAD', 10000], ['NAD', 5000]]);
  });

  it('rate limits the 51st submission per ip and day', async () => {
    const { db } = fakeDb();
    const env: Env = { DB: db };
    for (let i = 0; i < 50; i++) expect((await post(env, body(), '9.9.9.9', NOW + i)).status).toBe(201);
    const r = await post(env, body(), '9.9.9.9', NOW + 50);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate limited' });
    expect((await post(env, body(), '8.8.8.8')).status).toBe(201);
  });

  it('rejects blocked initials and bad json', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    expect((await post(env, body({ initials: 'ASS' }), '1.1.1.1')).status).toBe(400);
    expect((await post(env, '{nope', '1.1.1.1')).status).toBe(400);
    expect(scores).toHaveLength(0);
  });

  it('never stores the raw ip', async () => {
    const { db, scores, subs } = fakeDb();
    await post({ DB: db }, body(), '203.0.113.77');
    expect(JSON.stringify(scores)).not.toContain('203.0.113.77');
    expect(JSON.stringify([...subs.keys()])).not.toContain('203.0.113.77');
    expect(scores[0]!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('GET /api/scores', () => {
  it('works without a day param and ignores one if present', async () => {
    const { db } = fakeDb();
    const env: Env = { DB: db };
    await post(env, body(), '1.1.1.1');
    const a = await get(env, '');
    expect(a.status).toBe(200);
    expect(((await a.json()) as Top).top).toHaveLength(1);
    expect((await get(env, '?day=2020-01-01')).status).toBe(200);
  });

  it('caps the top at 10 across different days and ranks all-time', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    for (let i = 0; i < 12; i++) {
      scores.push({
        day: `2026-11-${String(1 + i).padStart(2, '0')}`, initials: 'ZZA', time_ms: 100000 - i, points: 1, closes: 1,
        input_log: '[]', ip_hash: 'h' + i, created_at: i,
      });
    }
    await post(env, body({ initials: 'LOW', timeMs: 1000, points: 0, closes: 0 }), '5.5.5.5');
    const res = await get(env, '?me=LOW');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const j = (await res.json()) as Top;
    expect(j.top).toHaveLength(10);
    expect(j.top[0]!.rank).toBe(1);
    expect(j.top[9]!.rank).toBe(10);
    expect(j.me).toMatchObject({ rank: 13, initials: 'LOW' });
    const none = (await (await get(env, '?me=QQQ')).json()) as Top;
    expect(none.me).toBeNull();
    const bad = (await (await get(env, '?me=ass')).json()) as Top;
    expect(bad.me).toBeNull();
  });
});

describe('routing', () => {
  it('404s unknown paths as json', async () => {
    const { db } = fakeDb();
    const r = await handle(new Request('http://x/api/nope'), { DB: db }, NOW);
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toContain('application/json');
  });
});
