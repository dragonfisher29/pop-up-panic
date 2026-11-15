import { describe, expect, it } from 'vitest';
import { RUNNER_RADIUS, RUNNER_SPEED, RUNNER_STAMINA_TICKS, TELL_TICKS } from '../constants';
import { advance, click, place, quiet } from '../testkit';
import type { Input } from '../types';

const ptr = (x: number, y: number): Input => ({ t: 'pointer', x, y });

describe('runner', () => {
  it('stays put while the cursor is far away', () => {
    const { s, w } = place(quiet(), 'runner', 500, 300);
    const after = advance(s, 30, [ptr(50, 50)]);
    const r = after.windows[0]!;
    expect([r.x, r.y]).toEqual([w.x, w.y]);
    expect(r.stage).toBe(0);
  });

  it('flashes for 300 ms before its first move, then slides away at RUNNER_SPEED px/tick', () => {
    const { s, w } = place(quiet(), 'runner', 500, 300); // 220×140
    const near = ptr(w.x - RUNNER_RADIUS + 10, w.y + 70); // 80 px left of it
    let t = advance(s, 1, [near]);
    const r0 = t.windows[0]!;
    expect(r0.stage).toBe(1);
    expect(r0.tellUntilTick).toBe(s.tick + TELL_TICKS);
    t = advance(t, TELL_TICKS - 1);
    expect(t.windows[0]!.x).toBe(w.x); // still telling
    const before = t.windows[0]!.x;
    t = advance(t, 1);
    const dx = t.windows[0]!.x - before;
    expect(dx).toBeGreaterThan(0); // away from a cursor on its left
    expect(dx).toBeLessThanOrEqual(RUNNER_SPEED);
  });

  it('is bounded by the desktop, so a corner traps it', () => {
    const { s } = place(quiet(), 'runner', 0, 0);
    const t = advance(s, 120, [ptr(250, 160)]); // cursor below-right, pushing it into the top-left corner
    const r = t.windows[0]!;
    expect([r.x, r.y]).toEqual([0, 0]);
  });

  it('gets tired after RUNNER_STAMINA_TICKS of fleeing, then stays put', () => {
    const { s, w } = place(quiet(), 'runner', 500, 300);
    // chase it from the left every tick: tell, then the whole stamina budget, plus slack
    let t = advance(s, 1, [ptr(w.x - 20, w.y + 70)]);
    for (let i = 0; i < TELL_TICKS + RUNNER_STAMINA_TICKS + 20; i++) {
      const r = t.windows[0]!;
      t = advance(t, 1, [ptr(r.x - 20, r.y + 70)]);
    }
    const tired = t.windows[0]!;
    expect(tired.stage).toBe(2);
    const later = advance(t, 30, [ptr(tired.x - 20, tired.y + 70)]).windows[0]!;
    expect([later.x, later.y]).toEqual([tired.x, tired.y]);
  });

  it('spends at most RUNNER_STAMINA_TICKS * RUNNER_SPEED px fleeing in total', () => {
    const { s, w } = place(quiet(), 'runner', 300, 300);
    let t = advance(s, 1, [ptr(w.x - 20, w.y + 70)]);
    for (let i = 0; i < 400; i++) {
      const r = t.windows[0]!;
      t = advance(t, 1, [ptr(r.x - 20, r.y + 70)]);
    }
    const moved = t.windows[0]!.x - w.x;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(RUNNER_STAMINA_TICKS * RUNNER_SPEED);
  });

  it('counter: once caught, the X closes it', () => {
    const { s, w } = place(quiet(), 'runner', 0, 0);
    const t = advance(s, 1, [ptr(10, 10), click(w.id)]);
    expect(t.windows).toHaveLength(0);
    expect(t.closes).toBe(1);
  });
});
