import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../sim';
import { place, quiet } from '../sim/testkit';
import { fxEvents } from './events';

describe('fxEvents', () => {
  const base = quiet(7);

  it('returns nothing for identical states', () => {
    expect(fxEvents(base, base)).toEqual([]);
    const { s } = place(base, 'ad');
    expect(fxEvents(s, s)).toEqual([]);
  });

  it('spawn: one event per new window id', () => {
    const { s, w } = place(base, 'fakeX');
    expect(fxEvents(base, s)).toEqual([{ t: 'spawn', kind: 'fakeX', id: w.id }]);
  });

  it('close: uses the previous geometry', () => {
    const { s, w } = place(base, 'ad', 100, 120);
    const next = { ...s, windows: [] };
    expect(fxEvents(s, next)).toEqual([{ t: 'close', id: w.id, kind: 'ad', x: w.x, y: w.y, w: w.w, h: w.h }]);
  });

  it('combo: only when it rises to 2 or more', () => {
    expect(fxEvents(base, { ...base, combo: 1 })).toEqual([]);
    expect(fxEvents(base, { ...base, combo: 2 })).toEqual([{ t: 'combo', n: 2 }]);
    expect(fxEvents({ ...base, combo: 4 }, { ...base, combo: 3 })).toEqual([]);
  });

  it('wave: when a new kind unlocks', () => {
    const a = { ...base, tick: 15 * TICK_HZ - 1 };
    const b = { ...base, tick: 15 * TICK_HZ };
    expect(fxEvents(a, b)).toEqual([{ t: 'wave', kind: 'fakeX' }]);
    expect(fxEvents(b, { ...b, tick: b.tick + 1 })).toEqual([]);
    expect(fxEvents({ ...base, tick: 0 }, { ...base, tick: 5 })).toEqual([]);
  });

  it('forceQuit and taskManager', () => {
    expect(fxEvents(base, { ...base, forceQuits: base.forceQuits - 1 })).toEqual([{ t: 'forceQuit' }]);
    expect(fxEvents(base, { ...base, taskManagerUsed: true })).toEqual([{ t: 'taskManager' }]);
    expect(fxEvents({ ...base, taskManagerUsed: true }, { ...base, taskManagerUsed: true })).toEqual([]);
  });

  it('crash: running to crashed', () => {
    expect(fxEvents(base, { ...base, status: 'crashed' })).toEqual([{ t: 'crash' }]);
    const c = { ...base, status: 'crashed' as const };
    expect(fxEvents(c, c)).toEqual([]);
  });
});
