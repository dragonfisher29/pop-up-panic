import { describe, expect, it, vi } from 'vitest';
import { encodeInput, fetchBoard, newPicker, pickerKey, pickerReady, pickerTap, submitScore, type Submission } from './leaderboard';

describe('initials picker', () => {
  it('starts on the saved initials, or blank so nobody sends AAA by accident', () => {
    expect(newPicker('NAD').letters.join('')).toBe('NAD');
    expect(newPicker(null).letters.join('')).toBe('___');
    expect(newPicker('bad!').letters.join('')).toBe('___');
  });

  it('a blank wheel rolls to A going down and Z going up', () => {
    expect(pickerTap(newPicker(null), 0, 1).letters.join('')).toBe('A__');
    expect(pickerTap(newPicker(null), 1, -1).letters.join('')).toBe('_Z_');
  });

  it('is ready to send only when all three wheels hold letters', () => {
    expect(pickerReady(newPicker(null))).toBe(false);
    expect(pickerReady(pickerKey(pickerKey(newPicker(null), 'a').picker, 'b').picker)).toBe(false);
    expect(pickerReady(newPicker('NAD'))).toBe(true);
  });

  it('Enter on blanks neither submits nor says blocked', () => {
    const r = pickerKey(pickerKey(newPicker(null), 'n').picker, 'Enter');
    expect(r.submit).toBeNull();
    expect(r.blocked).toBe(false);
  });

  it('wheels wrap A↔Z with up/down and move the cursor with left/right', () => {
    let p = newPicker('AAA');
    p = pickerKey(p, 'ArrowDown').picker; // down rolls the wheel forward, like an arcade cabinet
    expect(p.letters[0]).toBe('B');
    p = pickerKey(newPicker('AAA'), 'ArrowUp').picker;
    expect(p.letters[0]).toBe('Z');
    p = pickerKey(p, 'ArrowRight').picker;
    expect(p.cursor).toBe(1);
    p = pickerKey(pickerKey(p, 'ArrowRight').picker, 'ArrowRight').picker;
    expect(p.cursor).toBe(2);
    p = pickerKey(p, 'ArrowLeft').picker;
    expect(p.cursor).toBe(1);
  });

  it('a typed letter sets the wheel and advances', () => {
    const r = pickerKey(newPicker('AAA'), 'q');
    expect(r.picker.letters.join('')).toBe('QAA');
    expect(r.picker.cursor).toBe(1);
  });

  it('Enter submits valid initials and refuses blocked ones', () => {
    expect(pickerKey(newPicker('NAD'), 'Enter').submit).toBe('NAD');
    const blocked = pickerKey(newPicker('ASS'), 'Enter');
    expect(blocked.submit).toBeNull();
    expect(blocked.blocked).toBe(true);
  });

  it('taps step a wheel up or down', () => {
    expect(pickerTap(newPicker('AAA'), 2, 1).letters.join('')).toBe('AAB');
    expect(pickerTap(newPicker('AAA'), 0, -1).letters.join('')).toBe('ZAA');
  });
});

describe('encodeInput', () => {
  it('writes [tick, type, ...fields] in a fixed order', () => {
    expect(encodeInput(5, { t: 'pointer', x: 1, y: 2 })).toEqual([5, 'pointer', 1, 2]);
    expect(encodeInput(6, { t: 'click', id: 3, part: 'close' })).toEqual([6, 'click', 3, 'close']);
    expect(encodeInput(7, { t: 'drag', id: 3, dx: -4, dy: 9 })).toEqual([7, 'drag', 3, -4, 9]);
    expect(encodeInput(8, { t: 'taskManager' })).toEqual([8, 'taskManager']);
  });
});

const sub: Submission = { day: '2026-11-15', initials: 'NAD', timeMs: 1000, points: 3, closes: 1, inputLog: [[60, 'end']] };

describe('api client', () => {
  it('submitScore returns the rank on 201', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ rank: 4 }), { status: 201 }));
    expect(await submitScore(sub, f)).toEqual({ ok: true, rank: 4 });
    expect(f).toHaveBeenCalledWith('/api/score', expect.objectContaining({ method: 'POST' }));
  });

  it('submitScore reports rate limits, rejections and network errors', async () => {
    expect(await submitScore(sub, async () => new Response('{}', { status: 429 }))).toEqual({ ok: false, reason: 'rate' });
    expect(await submitScore(sub, async () => new Response('{"error":"x"}', { status: 400 }))).toEqual({ ok: false, reason: 'rejected' });
    expect(await submitScore(sub, async () => Promise.reject(new Error('offline')))).toEqual({ ok: false, reason: 'offline' });
  });

  it('fetchBoard parses top and me, and returns null on failure', async () => {
    const body = { top: [{ rank: 1, initials: 'AAA', timeMs: 5000, points: 9 }], me: null };
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    expect(await fetchBoard('2026-11-15', 'NAD', f)).toEqual(body);
    expect(f).toHaveBeenCalledWith('/api/scores?day=2026-11-15&me=NAD');
    expect(await fetchBoard('2026-11-15', null, async () => new Response('nope', { status: 500 }))).toBeNull();
  });
});
