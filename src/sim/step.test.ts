import { describe, expect, it } from 'vitest';
import {
  HANG_FUSE_TICKS,
  RAM_OS_BASE,
  SPAWN_EASE_TICKS,
  SPAWN_INTERVAL_END_TICKS,
  SPAWN_INTERVAL_START_TICKS,
} from './constants';
import { createGame, spawnIntervalAt, step, survivalMs } from './step';
import type { GameState, Input } from './types';

function run(seed: number, ticks: number, policy?: (s: GameState) => Input[]): GameState {
  let s = createGame(seed);
  for (let i = 0; i < ticks; i++) s = step(s, policy ? policy(s) : []);
  return s;
}

/** Closes the oldest window every 20 ticks (3 clicks per second). */
const closeOldest = (s: GameState): Input[] =>
  s.tick % 20 === 0 && s.windows.length > 0 ? [{ t: 'close', id: s.windows[0]!.id }] : [];

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
    const s0 = run(5, 200);
    const snapshot = JSON.stringify(s0);
    step(s0, s0.windows[0] ? [{ t: 'close', id: s0.windows[0].id }] : []);
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
    s = step(s, [{ t: 'close', id: target.id }]);
    expect(s.windows.find((w) => w.id === target.id)).toBeUndefined();
    expect(s.ram).toBeLessThan(before);
    expect(s.closes).toBe(1);
    expect(s.points).toBe(1);
  });

  it('builds combo for quick closes', () => {
    let s = run(3, 600);
    const ids = s.windows.slice(0, 3).map((w) => w.id);
    expect(ids.length).toBe(3);
    for (const id of ids) s = step(s, [{ t: 'close', id }]);
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
    const closeAll: Input[] = s.windows.map((w) => ({ t: 'close', id: w.id }));
    s = step(s, closeAll);
    expect(s.hangTicks).toBe(0);
    expect(s.status).toBe('running');
    expect(s.ram).toBeLessThanOrEqual(RAM_OS_BASE + 8_000);
  });

  it('spawn interval eases from start to end', () => {
    expect(spawnIntervalAt(0)).toBe(SPAWN_INTERVAL_START_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS)).toBe(SPAWN_INTERVAL_END_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS * 2)).toBe(SPAWN_INTERVAL_END_TICKS);
    expect(spawnIntervalAt(SPAWN_EASE_TICKS / 2)).toBeLessThan(SPAWN_INTERVAL_START_TICKS);
  });
});
