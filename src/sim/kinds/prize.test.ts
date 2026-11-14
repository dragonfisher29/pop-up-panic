import { describe, expect, it } from 'vitest';
import { PRIZE_SPAWNS, PRIZE_TIMER_TICKS, TELL_TICKS } from '../constants';
import { advance, byKind, click, place, quiet } from '../testkit';

describe('prize', () => {
  it('twist: at 0 it spawns 4 ads and closes itself, with a 300 ms tell first', () => {
    const { s, w } = place(quiet(), 'prize', 100, 100);
    expect(w.timerTick).toBe(s.tick + PRIZE_TIMER_TICKS);
    expect(w.tellUntilTick).toBe(w.timerTick);
    expect(w.tellUntilTick - TELL_TICKS).toBeGreaterThan(s.tick);
    const before = advance(s, PRIZE_TIMER_TICKS);
    expect(byKind(before, 'prize')).toHaveLength(1);
    const after = advance(before, 1);
    expect(byKind(after, 'prize')).toHaveLength(0);
    expect(byKind(after, 'ad')).toHaveLength(PRIZE_SPAWNS);
    expect(after.closes).toBe(0);
  });

  it('CLAIM pays out at once', () => {
    const { s, w } = place(quiet(), 'prize', 100, 100);
    const after = advance(s, 1, [click(w.id, 'body')]);
    expect(byKind(after, 'prize')).toHaveLength(0);
    expect(byKind(after, 'ad')).toHaveLength(PRIZE_SPAWNS);
  });

  it('counter: X before the timer ends closes it cleanly', () => {
    const { s, w } = place(quiet(), 'prize', 100, 100);
    const after = advance(s, PRIZE_TIMER_TICKS + 30, [click(w.id)]);
    expect(after.windows).toHaveLength(0);
    expect(after.closes).toBe(1);
  });
});
