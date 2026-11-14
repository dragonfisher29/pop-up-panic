import { describe, expect, it } from 'vitest';
import { LAUNCH_DAY } from '../sim';
import { dailySeed, dayKey, formatCountdown, msUntilNextDay, puzzleNumber } from './daily';

describe('dayKey', () => {
  it('uses the UTC date, not the local one', () => {
    expect(dayKey(new Date('2026-11-15T23:59:59.999Z'))).toBe('2026-11-15');
    expect(dayKey(new Date('2026-11-16T00:00:00Z'))).toBe('2026-11-16');
    expect(dayKey(new Date('2026-11-15T23:30:00-05:00'))).toBe('2026-11-16');
  });
});

describe('dailySeed', () => {
  it('is stable for a date', () => {
    expect(dailySeed('2026-11-15')).toBe(dailySeed('2026-11-15'));
    // Pinned value: changing it changes every past daily.
    expect(dailySeed('2026-11-15')).toMatchInlineSnapshot(`2069157927`);
  });

  it('differs between days and is a uint32', () => {
    const a = dailySeed('2026-11-15');
    const b = dailySeed('2026-11-16');
    expect(a).not.toBe(b);
    for (const s of [a, b]) expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });
});

describe('puzzleNumber', () => {
  it('is #1 on launch day and counts days after it', () => {
    expect(puzzleNumber(LAUNCH_DAY)).toBe(1);
    const next = dayKey(new Date(Date.parse(`${LAUNCH_DAY}T12:00:00Z`) + 86_400_000));
    expect(puzzleNumber(next)).toBe(2);
    const later = dayKey(new Date(Date.parse(`${LAUNCH_DAY}T00:00:00Z`) + 11 * 86_400_000));
    expect(puzzleNumber(later)).toBe(12);
  });
});

describe('msUntilNextDay', () => {
  it('counts down to UTC midnight', () => {
    expect(msUntilNextDay(new Date('2026-11-15T16:47:27Z'))).toBe(((7 * 60 + 12) * 60 + 33) * 1000);
    expect(msUntilNextDay(new Date('2026-11-15T23:59:59.500Z'))).toBe(500);
    expect(msUntilNextDay(new Date('2026-11-16T00:00:00Z'))).toBe(86_400_000);
  });
});

describe('formatCountdown', () => {
  it('formats hh:mm:ss and rounds up', () => {
    expect(formatCountdown(((7 * 60 + 12) * 60 + 33) * 1000)).toBe('07:12:33');
    expect(formatCountdown(500)).toBe('00:00:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(86_400_000)).toBe('24:00:00');
  });
});
