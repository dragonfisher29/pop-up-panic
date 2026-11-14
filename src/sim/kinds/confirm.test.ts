import { describe, expect, it } from 'vitest';
import { CONFIRM_MAX_STAGES, CONFIRM_MIN_STAGES, CONFIRM_OFFSET } from '../constants';
import { advance, byKind, click, place, quiet } from '../testkit';
import type { GameState } from '../types';

/** Clicks Yes on the newest dialog of the chain until it is gone. Returns the clicks used. */
function clickThrough(s: GameState): { s: GameState; clicks: number } {
  let t = s;
  let clicks = 0;
  while (byKind(t, 'confirm').length > 0 && clicks < 10) {
    const top = byKind(t, 'confirm').reduce((a, b) => (b.stage > a.stage ? b : a));
    t = advance(t, 1, [click(top.id, 'body')]);
    clicks++;
  }
  return { s: t, clicks };
}

describe('confirm', () => {
  it('spawns as stage 0 of a 2–3 dialog chain', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { w } = place(quiet(seed), 'confirm', 100, 100);
      expect(w.stage).toBe(0);
      expect(w.link).toBe(w.id);
      expect(w.stageCount).toBeGreaterThanOrEqual(CONFIRM_MIN_STAGES);
      expect(w.stageCount).toBeLessThanOrEqual(CONFIRM_MAX_STAGES);
    }
  });

  it('twist: X opens "Really?" on top instead of closing', () => {
    const { s, w } = place(quiet(), 'confirm', 100, 100);
    const t = advance(s, 1, [click(w.id)]);
    const chain = byKind(t, 'confirm');
    expect(chain).toHaveLength(2);
    const next = chain.find((c) => c.id !== w.id)!;
    expect(next.stage).toBe(1);
    expect(next.link).toBe(w.id);
    expect([next.x, next.y]).toEqual([w.x + CONFIRM_OFFSET, w.y + CONFIRM_OFFSET]);
    expect(t.closes).toBe(0);
  });

  it('counter: clicking through, the last Yes closes the whole chain', () => {
    const { s, w } = place(quiet(4), 'confirm', 100, 100);
    const { s: t, clicks } = clickThrough(s);
    expect(clicks).toBe(w.stageCount);
    expect(t.windows).toHaveLength(0);
    expect(t.closes).toBe(w.stageCount);
  });

  it('No does nothing, and an older dialog cannot open a second branch', () => {
    const { s, w } = place(quiet(), 'confirm', 100, 100);
    let t = advance(s, 1, [click(w.id, 'cancel')]);
    expect(byKind(t, 'confirm')).toHaveLength(1);
    t = advance(t, 1, [click(w.id, 'body')]);
    t = advance(t, 1, [click(w.id, 'body')]);
    expect(byKind(t, 'confirm')).toHaveLength(2);
  });
});
