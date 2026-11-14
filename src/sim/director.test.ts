import { describe, expect, it } from 'vitest';
import {
  ANTIVIRUS_UNLOCK_TICK,
  BURST_EVERY_TICKS,
  BURST_MAX,
  BURST_MIN,
  DESKTOP_H,
  DESKTOP_W,
  NEWEST_BOOST_TICKS,
  STRIP_H,
  TASKBAR_H,
  TICK_HZ,
} from './constants';
import { kindWeights, pickKind, unlockedKinds } from './director';
import { createGame, step } from './step';
import { advance, quiet } from './testkit';
import type { GameState } from './types';

describe('unlock waves', () => {
  it('starts with ads only and adds one type every 15 s', () => {
    expect(unlockedKinds(0)).toEqual(['ad']);
    expect(unlockedKinds(15 * TICK_HZ - 1)).toEqual(['ad']);
    expect(unlockedKinds(15 * TICK_HZ)).toEqual(['ad', 'fakeX']);
    expect(unlockedKinds(90 * TICK_HZ)).toEqual(['ad', 'fakeX', 'runner', 'prize', 'virusScan', 'confirm', 'toolbar']);
  });

  it('doubles the newest type weight for 10 s after it unlocks', () => {
    const at = (tick: number, kind: string) => kindWeights(tick).find((k) => k.kind === kind)!.weight;
    expect(at(30 * TICK_HZ, 'runner')).toBe(2 * at(30 * TICK_HZ, 'ad'));
    expect(at(30 * TICK_HZ + NEWEST_BOOST_TICKS - 1, 'runner')).toBe(2 * at(30 * TICK_HZ, 'ad'));
    expect(at(30 * TICK_HZ + NEWEST_BOOST_TICKS, 'runner')).toBe(at(30 * TICK_HZ, 'ad'));
  });
});

describe('pickKind', () => {
  it('never picks a locked type', () => {
    let rng = 7;
    for (let i = 0; i < 500; i++) {
      const r = pickKind(rng, 14 * TICK_HZ);
      expect(r.kind).toBe('ad');
      rng = r.rng;
    }
  });

  it('never picks antivirus before 20 s, and about 1 in 25 after', () => {
    let rng = 99;
    for (let i = 0; i < 500; i++) {
      const r = pickKind(rng, ANTIVIRUS_UNLOCK_TICK - 1);
      expect(r.kind).not.toBe('antivirus');
      rng = r.rng;
    }
    let av = 0;
    for (let i = 0; i < 5000; i++) {
      const r = pickKind(rng, ANTIVIRUS_UNLOCK_TICK);
      if (r.kind === 'antivirus') av++;
      rng = r.rng;
    }
    expect(av).toBeGreaterThan(5000 / 25 / 2);
    expect(av).toBeLessThan((5000 / 25) * 2);
  });

  it('picks every unlocked type eventually', () => {
    const seen = new Set<string>();
    let rng = 3;
    for (let i = 0; i < 2000; i++) {
      const r = pickKind(rng, 120 * TICK_HZ);
      seen.add(r.kind);
      rng = r.rng;
    }
    expect(seen.size).toBe(8);
  });
});

describe('bursts', () => {
  it('spawns 3–5 windows within 400 ms every 25 s', () => {
    let s = { ...quiet(5), nextBurstTick: BURST_EVERY_TICKS };
    s = advance(s, BURST_EVERY_TICKS);
    expect(s.windows.length).toBe(0);
    s = advance(s, 25);
    expect(s.windows.length).toBeGreaterThanOrEqual(BURST_MIN);
    expect(s.windows.length).toBeLessThanOrEqual(BURST_MAX);
    const born = s.windows.map((w) => w.bornTick);
    expect(Math.max(...born) - Math.min(...born)).toBeLessThanOrEqual(24);
    expect(s.nextBurstTick).toBe(2 * BURST_EVERY_TICKS);
  });

  it('the first burst is scheduled at 25 s', () => {
    expect(createGame(1).nextBurstTick).toBe(BURST_EVERY_TICKS);
  });
});

describe('spawn area', () => {
  it('keeps every spawned window inside the desktop above the taskbar', () => {
    let s = createGame(11);
    for (let i = 0; i < 60 * TICK_HZ; i++) {
      s = step(s, []);
      if (s.status === 'crashed') break;
    }
    expect(s.windows.length).toBeGreaterThan(10);
    for (const w of s.windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w).toBeLessThanOrEqual(DESKTOP_W);
      expect(w.y + w.h).toBeLessThanOrEqual(DESKTOP_H - TASKBAR_H);
    }
  });

  it('spawns below the toolbar strips', () => {
    let s: GameState = { ...createGame(12), strips: [{ id: 900, name: 0 }, { id: 901, name: 1 }] };
    for (let i = 0; i < 20 * TICK_HZ; i++) s = step(s, []);
    for (const w of s.windows) expect(w.y).toBeGreaterThanOrEqual(2 * STRIP_H);
  });
});
