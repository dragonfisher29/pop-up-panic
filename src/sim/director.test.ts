import { describe, expect, it } from 'vitest';
import {
  ANTIVIRUS_EVERY_TICKS,
  ANTIVIRUS_FIRST_TICK,
  BURST_EVERY_TICKS,
  BURST_MAX,
  BURST_MIN,
  DESKTOP_H,
  DESKTOP_W,
  KIND_WEIGHT,
  NEWEST_BOOST_MULT,
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
    const base = KIND_WEIGHT.runner;
    expect(at(30 * TICK_HZ, 'runner')).toBe(NEWEST_BOOST_MULT * base);
    expect(at(30 * TICK_HZ + NEWEST_BOOST_TICKS - 1, 'runner')).toBe(NEWEST_BOOST_MULT * base);
    expect(at(30 * TICK_HZ + NEWEST_BOOST_TICKS, 'runner')).toBe(base);
    expect(at(30 * TICK_HZ, 'ad')).toBe(KIND_WEIGHT.ad);
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

  it('never picks antivirus at random (it has its own schedule)', () => {
    let rng = 99;
    for (let i = 0; i < 5000; i++) {
      const r = pickKind(rng, 120 * TICK_HZ);
      expect(r.kind).not.toBe('antivirus');
      rng = r.rng;
    }
  });

  it('picks every unlocked hostile type eventually', () => {
    const seen = new Set<string>();
    let rng = 3;
    for (let i = 0; i < 2000; i++) {
      const r = pickKind(rng, 120 * TICK_HZ);
      seen.add(r.kind);
      rng = r.rng;
    }
    expect(seen.size).toBe(7);
  });
});

describe('antivirus schedule', () => {
  /** Ticks at which an antivirus appeared, with the regular director switched off. */
  function antivirusTicks(seed: number, ticks: number, keepOpen: boolean): number[] {
    let s: GameState = { ...quiet(seed), nextAntivirusTick: ANTIVIRUS_FIRST_TICK };
    const out: number[] = [];
    let seen = 0;
    for (let i = 0; i < ticks; i++) {
      s = step(s, []);
      const avs = s.windows.filter((w) => w.kind === 'antivirus');
      if (avs.length > seen) out.push(s.tick);
      seen = avs.length;
      if (!keepOpen && avs.length > 0) s = { ...s, windows: s.windows.filter((w) => w.kind !== 'antivirus') };
      if (!keepOpen) seen = 0;
    }
    return out;
  }

  it('spawns one every ANTIVIRUS_EVERY_TICKS from ANTIVIRUS_FIRST_TICK, whatever the seed', () => {
    const expected = [0, 1, 2, 3].map((n) => ANTIVIRUS_FIRST_TICK + n * ANTIVIRUS_EVERY_TICKS);
    const span = ANTIVIRUS_FIRST_TICK + 3 * ANTIVIRUS_EVERY_TICKS + 2;
    expect(antivirusTicks(1, span, false).map((t) => t - 1)).toEqual(expected);
    expect(antivirusTicks(42, span, false).map((t) => t - 1)).toEqual(expected);
  });

  it('spawns on schedule even while one is still open', () => {
    const span = ANTIVIRUS_FIRST_TICK + ANTIVIRUS_EVERY_TICKS + 2;
    expect(antivirusTicks(7, span, true)).toHaveLength(2);
  });

  it('is on in a real game: first helper at 20 s', () => {
    expect(createGame(1).nextAntivirusTick).toBe(20 * TICK_HZ);
    expect(ANTIVIRUS_EVERY_TICKS).toBe(20 * TICK_HZ);
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
