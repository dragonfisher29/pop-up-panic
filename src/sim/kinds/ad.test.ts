import { describe, expect, it } from 'vitest';
import { advance, click, place, quiet } from '../testkit';

describe('ad', () => {
  it('closes on X and scores', () => {
    const { s, w } = place(quiet(), 'ad', 100, 100);
    const after = advance(s, 1, [click(w.id)]);
    expect(after.windows).toHaveLength(0);
    expect(after.points).toBe(1);
  });

  it('ignores clicks on other parts', () => {
    const { s, w } = place(quiet(), 'ad', 100, 100);
    const after = advance(s, 1, [click(w.id, 'body'), click(w.id, 'link')]);
    expect(after.windows).toHaveLength(1);
  });
});
