import { describe, expect, it } from 'vitest';
import { advance, byKind, click, place, quiet } from '../testkit';

describe('fakeX', () => {
  it('twist: the X spawns another ad and stays open', () => {
    const { s, w } = place(quiet(), 'fakeX', 100, 100);
    const after = advance(s, 1, [click(w.id, 'close')]);
    expect(byKind(after, 'fakeX')).toHaveLength(1);
    expect(byKind(after, 'ad')).toHaveLength(1);
    expect(after.closes).toBe(0);
  });

  it('counter: the "no thanks" link closes it', () => {
    const { s, w } = place(quiet(), 'fakeX', 100, 100);
    const after = advance(s, 1, [click(w.id, 'link')]);
    expect(after.windows).toHaveLength(0);
    expect(after.closes).toBe(1);
  });
});
