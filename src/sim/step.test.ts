import { describe, expect, it } from 'vitest';
import {
  DESKTOP_H,
  DESKTOP_W,
  HANG_FUSE_TICKS,
  RAM_OS_BASE,
  SPAWN_EASE_TICKS,
  SPAWN_INTERVAL_END_TICKS,
  SPAWN_INTERVAL_START_TICKS,
  TASKBAR_H,
} from './constants';
import { createGame, spawnIntervalAt, step, survivalMs } from './step';
import type { GameState, Input } from './types';

function run(seed: number, ticks: number, policy?: (s: GameState) => Input[]): GameState {
  let s = createGame(seed);
  for (let i = 0; i < ticks; i++) s = step(s, policy ? policy(s) : []);
  return s;
}

const close = (id: number): Input => ({ t: 'click', id, part: 'close' });

/** Closes the oldest window every 20 ticks (3 clicks per second). */
const closeOldest = (s: GameState): Input[] =>
  s.tick % 20 === 0 && s.windows.length > 0 ? [close(s.windows[0]!.id)] : [];

/** Runs until at least `n` windows are open. */
function withWindows(seed: number, n: number): GameState {
  let s = createGame(seed);
  while (s.windows.length < n) s = step(s, []);
  return s;
}

describe('step', () => {
  it('is deterministic: same seed and inputs give identical state', () => {
    const a = run(123, 3600, closeOldest);
    const b = run(123, 3600, closeOldest);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds give different runs', () => {
    expect(JSON.stringify(run(1, 600))).not.toBe(JSON.stringify(run(2, 600)));
  });

  it('never mutates the previous state', () => {
    const s0 = withWindows(5, 2);
    const snapshot = JSON.stringify(s0);
    const id = s0.windows[0]!.id;
    step(s0, [
      { t: 'pointer', x: 10, y: 10 },
      { t: 'focus', id },
      { t: 'drag', id, dx: 5, dy: 5 },
      close(s0.windows[1]!.id),
    ]);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it('keeps gameplay values as integers', () => {
    const s = run(9, 1800, closeOldest);
    expect(Number.isInteger(s.ram)).toBe(true);
    for (const w of s.windows) {
      for (const v of [w.x, w.y, w.w, w.h, w.ram, w.z]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('closing a window frees its RAM and scores a point', () => {
    let s = run(11, 120);
    expect(s.windows.length).toBeGreaterThan(0);
    const before = s.ram;
    const target = s.windows[0]!;
    s = step(s, [close(target.id)]);
    expect(s.windows.find((w) => w.id === target.id)).toBeUndefined();
    expect(s.ram).toBeLessThan(before);
    expect(s.closes).toBe(1);
    expect(s.points).toBe(1);
  });

  it('builds combo for quick closes', () => {
    let s = run(3, 600);
    const ids = s.windows.slice(0, 3).map((w) => w.id);
    expect(ids.length).toBe(3);
    for (const id of ids) s = step(s, [close(id)]);
    expect(s.combo).toBe(3);
    expect(s.points).toBe(1 + 2 + 3);
  });

  it('crashes after the hang fuse when nobody closes anything', () => {
    const s = run(77, 60 * 120);
    expect(s.status).toBe('crashed');
    expect(s.crashTick).not.toBeNull();
    expect(survivalMs(s)).toBeGreaterThan(0);
    const frozen = step(s, []);
    expect(frozen).toBe(s);
  });

  it('cancels the hang fuse when RAM drops below 100%', () => {
    let s = createGame(99);
    while (s.hangTicks === 0 && s.status === 'running') s = step(s, []);
    expect(s.hangTicks).toBeGreaterThan(0);
    expect(s.hangTicks).toBeLessThan(HANG_FUSE_TICKS);
    s = step(s, [{ t: 'taskManager' }]);
    expect(s.hangTicks).toBe(0);
    expect(s.status).toBe('running');
    const friendly = s.windows.filter((w) => w.kind === 'antivirus').reduce((sum, w) => sum + w.ram, 0);
    expect(s.ram).toBeLessThanOrEqual(RAM_OS_BASE + friendly + 8_000);
  });

  it('spawn interval eases from start to end', () => {
    expect(spawnIntervalAt(0)).toBe(SPAWN_INTERVAL_START_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS)).toBe(SPAWN_INTERVAL_END_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS * 2)).toBe(SPAWN_INTERVAL_END_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS / 2)).toBeLessThan(SPAWN_INTERVAL_START_TICKS);
  });
});

describe('focus', () => {
  it('raises the focused window above every other window', () => {
    let s = withWindows(21, 3);
    const bottom = s.windows[0]!;
    s = step(s, [{ t: 'focus', id: bottom.id }]);
    const focused = s.windows.find((w) => w.id === bottom.id)!;
    for (const w of s.windows) if (w.id !== bottom.id) expect(focused.z).toBeGreaterThan(w.z);
  });

  it('does not change z when the window is already on top', () => {
    let s = withWindows(21, 3);
    const top = s.windows.reduce((a, b) => (b.z > a.z ? b : a));
    const nextZ = s.nextZ;
    s = step(s, [{ t: 'focus', id: top.id }]);
    expect(s.windows.find((w) => w.id === top.id)!.z).toBe(top.z);
    expect(s.nextZ).toBe(nextZ);
  });

  it('ignores an unknown id', () => {
    const s = withWindows(21, 1);
    const next = step(s, [{ t: 'focus', id: 9999 }]);
    expect(next.windows.map((w) => w.z)).toEqual(s.windows.map((w) => w.z));
  });
});

describe('drag', () => {
  const maxY = DESKTOP_H - TASKBAR_H;

  it('moves a window by integer dx/dy', () => {
    let s = withWindows(31, 1);
    const w = s.windows[0]!;
    // pick a safe delta that stays inside the desktop
    const dx = w.x > 20 ? -10 : 10;
    const dy = w.y > 20 ? -10 : 10;
    s = step(s, [{ t: 'drag', id: w.id, dx, dy }]);
    const moved = s.windows.find((v) => v.id === w.id)!;
    expect(moved.x).toBe(w.x + dx);
    expect(moved.y).toBe(w.y + dy);
  });

  it('clamps to the left and top edges', () => {
    let s = withWindows(31, 1);
    const id = s.windows[0]!.id;
    s = step(s, [{ t: 'drag', id, dx: -5000, dy: -5000 }]);
    const w = s.windows.find((v) => v.id === id)!;
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
  });

  it('clamps to the right edge and above the taskbar', () => {
    let s = withWindows(31, 1);
    const id = s.windows[0]!.id;
    s = step(s, [{ t: 'drag', id, dx: 5000, dy: 5000 }]);
    const w = s.windows.find((v) => v.id === id)!;
    expect(w.x).toBe(DESKTOP_W - w.w);
    expect(w.y).toBe(maxY - w.h);
  });

  it('truncates non-integer deltas', () => {
    let s = withWindows(31, 1);
    const w0 = s.windows[0]!;
    const dx = w0.x > 20 ? -3.9 : 3.9;
    s = step(s, [{ t: 'drag', id: w0.id, dx, dy: 0 }]);
    const w = s.windows.find((v) => v.id === w0.id)!;
    expect(w.x).toBe(w0.x + Math.trunc(dx));
    expect(Number.isInteger(w.x)).toBe(true);
  });

  it('ignores an unknown id', () => {
    const s = withWindows(31, 1);
    const next = step(s, [{ t: 'drag', id: 9999, dx: 10, dy: 10 }]);
    expect(next.windows[0]!.x).toBe(s.windows[0]!.x);
  });
});

describe('bad inputs', () => {
  it('ignores clicks on parts other than close (until M2 kinds use them)', () => {
    const s = withWindows(41, 1);
    const id = s.windows[0]!.id;
    const next = step(s, (['body', 'link', 'cancel', 'tray'] as const).map((part) => ({ t: 'click', id, part })));
    expect(next.windows.find((w) => w.id === id)).toBeDefined();
    expect(next.closes).toBe(0);
  });

  it('treats non-finite pointer and drag values as 0 so state stays integer', () => {
    let s = withWindows(41, 1);
    const w0 = s.windows[0]!;
    s = step(s, [
      { t: 'pointer', x: Number.NaN, y: Number.POSITIVE_INFINITY },
      { t: 'drag', id: w0.id, dx: Number.NaN, dy: Number.NEGATIVE_INFINITY },
    ]);
    const w = s.windows.find((v) => v.id === w0.id)!;
    expect([s.pointerX, s.pointerY]).toEqual([0, 0]);
    expect([w.x, w.y]).toEqual([w0.x, w0.y]);
  });
});

describe('pointer', () => {
  it('stores the latest pointer sample as integers inside the desktop', () => {
    let s = createGame(1);
    expect(s.pointerX).toBe(DESKTOP_W >> 1);
    s = step(s, [{ t: 'pointer', x: 100.7, y: 200.2 }]);
    expect(s.pointerX).toBe(100);
    expect(s.pointerY).toBe(200);
    s = step(s, [{ t: 'pointer', x: -50, y: 99_999 }]);
    expect(s.pointerX).toBe(0);
    expect(s.pointerY).toBe(DESKTOP_H - 1);
  });
});
