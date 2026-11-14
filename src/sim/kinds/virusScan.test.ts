import { describe, expect, it } from 'vitest';
import { VIRUSSCAN_SPAWNS } from '../constants';
import { advance, byKind, click, place, quiet } from '../testkit';

describe('virusScan', () => {
  it('twist: X closes it but spawns 2 more scans', () => {
    const { s, w } = place(quiet(), 'virusScan', 100, 100);
    const after = advance(s, 1, [click(w.id)]);
    expect(after.windows.find((v) => v.id === w.id)).toBeUndefined();
    expect(byKind(after, 'virusScan')).toHaveLength(VIRUSSCAN_SPAWNS);
  });

  it('counter: Cancel scan closes it with no copies', () => {
    const { s, w } = place(quiet(), 'virusScan', 100, 100);
    const after = advance(s, 1, [click(w.id, 'cancel')]);
    expect(after.windows).toHaveLength(0);
    expect(after.closes).toBe(1);
  });
});
