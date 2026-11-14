import { describe, expect, it } from 'vitest';
import { MAX_LOG_BYTES, previousDay, validateSubmission } from './validate';

const TODAY = '2026-11-15';

function good(): Record<string, unknown> {
  return {
    day: TODAY,
    initials: 'NAD',
    timeMs: 1000,
    points: 16,
    closes: 3,
    inputLog: [[0, 'pointer', 1, 2], [30, 'click'], [60, 'click']],
  };
}

function check(patch: Record<string, unknown>) {
  return validateSubmission({ ...good(), ...patch }, TODAY);
}

describe('previousDay', () => {
  it('handles month and year boundaries', () => {
    expect(previousDay('2026-11-15')).toBe('2026-11-14');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('validateSubmission', () => {
  it('accepts a good submission', () => {
    const r = validateSubmission(good(), TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.initials).toBe('NAD');
  });
  it('rejects non-objects', () => {
    expect(validateSubmission(null, TODAY).ok).toBe(false);
    expect(validateSubmission('x', TODAY).ok).toBe(false);
  });

  it('day: accepts yesterday', () => {
    expect(check({ day: '2026-11-14' }).ok).toBe(true);
  });
  it('day: rejects other days and bad formats', () => {
    expect(check({ day: '2026-11-13' })).toEqual({ ok: false, error: 'bad day' });
    expect(check({ day: '2026-11-16' }).ok).toBe(false);
    expect(check({ day: 5 }).ok).toBe(false);
  });

  it('initials: rejects blocked, lowercase, non-string', () => {
    expect(check({ initials: 'ASS' })).toEqual({ ok: false, error: 'bad initials' });
    expect(check({ initials: 'nad' }).ok).toBe(false);
    expect(check({ initials: 7 }).ok).toBe(false);
  });

  it('integers: rejects floats and strings', () => {
    expect(check({ timeMs: 1000.5 })).toEqual({ ok: false, error: 'numbers must be integers' });
    expect(check({ points: '16' }).ok).toBe(false);
    expect(check({ closes: 2.5 }).ok).toBe(false);
  });

  it('timeMs: bounds', () => {
    expect(check({ timeMs: 0 })).toEqual({ ok: false, error: 'bad time' });
    expect(check({ timeMs: -5 }).ok).toBe(false);
    expect(check({ timeMs: 600001 }).ok).toBe(false);
    const log = [[0, 'a'], [35000, 'b']];
    expect(check({ timeMs: 600000, points: 0, closes: 0, inputLog: [[0, 'a'], [36000, 'b']] }).ok).toBe(true);
    expect(check({ timeMs: 600000, points: 0, closes: 0, inputLog: log }).ok).toBe(false);
  });

  it('points and closes: non-negative', () => {
    expect(check({ points: -1 })).toEqual({ ok: false, error: 'bad points' });
    expect(check({ closes: -1 })).toEqual({ ok: false, error: 'bad closes' });
    expect(check({ points: 0, closes: 0 }).ok).toBe(true);
  });

  it('inputLog: must be a non-empty array of arrays with integer ticks', () => {
    expect(check({ inputLog: [] })).toEqual({ ok: false, error: 'bad input log' });
    expect(check({ inputLog: 'x' }).ok).toBe(false);
    expect(check({ inputLog: [5] }).ok).toBe(false);
    expect(check({ inputLog: [['a', 1]] }).ok).toBe(false);
    expect(check({ inputLog: [[1.5, 1]] }).ok).toBe(false);
    expect(check({ inputLog: [[], [60]] }).ok).toBe(false);
  });

  it('last tick: must cover timeMs minus 2', () => {
    // timeMs 1000 -> 60 ticks, need last >= 58
    expect(check({ inputLog: [[0], [58], [58]] }).ok).toBe(true);
    expect(check({ inputLog: [[0], [57], [57]] })).toEqual({ ok: false, error: 'log too short' });
  });

  it('closes <= inputLog.length', () => {
    expect(check({ closes: 3, points: 0 }).ok).toBe(true);
    expect(check({ closes: 4, points: 0 })).toEqual({ ok: false, error: 'too many closes' });
  });

  it('points <= closes * 8', () => {
    expect(check({ points: 24 }).ok).toBe(true);
    expect(check({ points: 25 })).toEqual({ ok: false, error: 'too many points' });
  });

  it('inputLog size <= MAX_LOG_BYTES (1 MB)', () => {
    expect(MAX_LOG_BYTES).toBe(1024 * 1024);
    // '[[0],[60],[61,"' + x + '"]]' is 15 + n + 3 chars wide
    const overhead = JSON.stringify([[0], [60], [61, '']]).length;
    const sized = (total: number) => [[0], [60], [61, 'x'.repeat(total - overhead)]];
    expect(JSON.stringify(sized(MAX_LOG_BYTES)).length).toBe(MAX_LOG_BYTES);
    expect(check({ points: 0, closes: 0, inputLog: sized(MAX_LOG_BYTES) }).ok).toBe(true);
    expect(check({ points: 0, closes: 0, inputLog: sized(MAX_LOG_BYTES + 1) })).toEqual({ ok: false, error: 'input log too big' });
  });

  it('last tick is the first element of the last entry, whatever its type', () => {
    expect(check({ points: 0, closes: 0, inputLog: [[0], [60, 'end']] }).ok).toBe(true);
  });
});
