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
      const row: Row = { day, initials, time_ms, points, closes, input_log, ip_hash, created_at };
      const i = scores.findIndex((r) => r.day === day && r.initials === initials && r.ip_hash === ip_hash);
      if (i < 0) scores.push(row);
      else {
        const o = scores[i]!;
        if (time_ms > o.time_ms || (time_ms === o.time_ms && points > o.points)) scores[i] = row;
      }
      return null;
    }
    if (sql.includes('COUNT(*)')) {
      const [day, t1, t2, p2, t3, p3, c3] = v as [string, number, number, number, number, number, number];
      const n = scores.filter(
        (r) =>
          r.day === day &&
          (r.time_ms > t1 || (r.time_ms === t2 && r.points > p2) || (r.time_ms === t3 && r.points === p3 && r.created_at < c3)),
      ).length;
      return { n };
    }
    if (sql.includes('LIMIT 100')) {
      return [...scores].filter((r) => r.day === v[0]).sort(better).slice(0, 100);
    }
    if (sql.includes('AND initials = ? ORDER BY')) {
      return [...scores].filter((r) => r.day === v[0] && r.initials === v[1]).sort(better)[0] ?? null;
    }
    if (sql.includes('AND ip_hash = ?')) {
      return scores.find((r) => r.day === v[0] && r.initials === v[1] && r.ip_hash === v[2]) ?? null;
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
    day: DAY, initials: 'NAD', timeMs: 10000, points: 16, closes: 3,
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
    const top = (await (await get(env, `?day=${DAY}`)).json()) as { top: { initials: string; rank: number }[] };
    expect(top.top.map((t) => t.initials)).toEqual(['BBB', 'CCC', 'AAA']);
  });

  it('keeps a better resubmit and ignores a worse one', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    await post(env, body({ timeMs: 10000 }), '1.1.1.1');
    const worse = await post(env, body({ timeMs: 5000 }), '1.1.1.1');
    expect(worse.status).toBe(201);
    expect(scores).toHaveLength(1);
    expect(scores[0]!.time_ms).toBe(10000);
    await post(env, body({ timeMs: 12000, inputLog: [[0], [1], [800]] }), '1.1.1.1');
    expect(scores).toHaveLength(1);
    expect(scores[0]!.time_ms).toBe(12000);
  });

  it('rate limits the 6th submission per ip and day', async () => {
    const { db } = fakeDb();
    const env: Env = { DB: db };
    for (let i = 0; i < 5; i++) expect((await post(env, body(), '9.9.9.9')).status).toBe(201);
    const r = await post(env, body(), '9.9.9.9');
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate limited' });
    expect((await post(env, body(), '8.8.8.8')).status).toBe(201);
  });

  it('rejects blocked initials, bad json and invalid bodies', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    expect((await post(env, body({ initials: 'ASS' }), '1.1.1.1')).status).toBe(400);
    expect((await post(env, '{nope', '1.1.1.1')).status).toBe(400);
    expect((await post(env, body({ day: '2026-01-01' }), '1.1.1.1')).status).toBe(400);
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
  it('rejects a bad day', async () => {
    const { db } = fakeDb();
    expect((await get({ DB: db }, '?day=2020-01-01')).status).toBe(400);
    expect((await get({ DB: db }, '')).status).toBe(400);
  });

  it('returns me outside the top 100, and null when absent', async () => {
    const { db, scores } = fakeDb();
    const env: Env = { DB: db };
    for (let i = 0; i < 105; i++) {
      scores.push({
        day: DAY, initials: 'ZZA', time_ms: 100000 - i, points: 1, closes: 1,
        input_log: '[]', ip_hash: 'h' + i, created_at: i,
      });
    }
    await post(env, body({ initials: 'LOW', timeMs: 1000, points: 0, closes: 0 }), '5.5.5.5');
    const res = await get(env, `?day=${DAY}&me=LOW`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const j = (await res.json()) as { top: { rank: number }[]; me: { rank: number; initials: string } | null };
    expect(j.top).toHaveLength(100);
    expect(j.top[0]!.rank).toBe(1);
    expect(j.me).toMatchObject({ rank: 106, initials: 'LOW' });
    const none = (await (await get(env, `?day=${DAY}&me=QQQ`)).json()) as { me: unknown };
    expect(none.me).toBeNull();
    const bad = (await (await get(env, `?day=${DAY}&me=ass`)).json()) as { me: unknown };
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
