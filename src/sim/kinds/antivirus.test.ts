import { describe, expect, it } from 'vitest';
import { ANTIVIRUS_BITE_TICKS, ANTIVIRUS_PENALTY_RAM, ANTIVIRUS_PENALTY_TICKS, RAM_OS_BASE, TELL_TICKS } from '../constants';
import { advance, byKind, click, place, quiet } from '../testkit';

describe('antivirus', () => {
  it('friendly: every 4 s it closes the oldest hostile window, after a tell', () => {
    let s = quiet();
    const a1 = place(s, 'ad', 0, 0);
    const av = place(a1.s, 'antivirus', 600, 300);
    const a2 = place(av.s, 'ad', 300, 0);
    s = a2.s;
    expect(av.w.timerTick).toBe(s.tick + ANTIVIRUS_BITE_TICKS);
    expect(av.w.tellUntilTick).toBe(av.w.timerTick);
    expect(av.w.tellUntilTick - TELL_TICKS).toBeGreaterThan(s.tick);
    let t = advance(s, ANTIVIRUS_BITE_TICKS);
    expect(t.windows.map((w) => w.id)).toContain(a1.w.id);
    t = advance(t, 1);
    expect(t.windows.map((w) => w.id)).not.toContain(a1.w.id);
    expect(t.windows.map((w) => w.id)).toContain(a2.w.id);
    expect(t.closes).toBe(0);
    t = advance(t, ANTIVIRUS_BITE_TICKS);
    expect(byKind(t, 'ad')).toHaveLength(0);
    expect(byKind(t, 'antivirus')).toHaveLength(1);
  });

  it('never eats another antivirus', () => {
    const one = place(quiet(), 'antivirus', 0, 0);
    const two = place(one.s, 'antivirus', 400, 0);
    const t = advance(two.s, ANTIVIRUS_BITE_TICKS * 3);
    expect(byKind(t, 'antivirus')).toHaveLength(2);
  });

  it('closing it costs +15% RAM for 1 s', () => {
    const { s, w } = place(quiet(), 'antivirus', 0, 0);
    let t = advance(s, 1, [click(w.id)]);
    expect(t.windows).toHaveLength(0);
    expect(t.ram).toBe(RAM_OS_BASE + ANTIVIRUS_PENALTY_RAM);
    t = advance(t, ANTIVIRUS_PENALTY_TICKS);
    expect(t.ram).toBe(RAM_OS_BASE);
  });
});
