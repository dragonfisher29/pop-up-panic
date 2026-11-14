import { describe, expect, it } from 'vitest';
import type { PopupKind } from '../sim';
import { alarmPeriodMs, blipFreq, comboFreq } from './audio';

const KINDS: PopupKind[] = ['ad', 'fakeX', 'runner', 'prize', 'virusScan', 'confirm', 'toolbar', 'antivirus'];

describe('audio helpers', () => {
  it('blipFreq is distinct per kind', () => {
    const f = KINDS.map(blipFreq);
    expect(new Set(f).size).toBe(KINDS.length);
    for (const x of f) expect(x).toBeGreaterThan(100);
  });

  it('comboFreq rises with n and is capped', () => {
    expect(comboFreq(3)).toBeGreaterThan(comboFreq(2));
    expect(comboFreq(6)).toBeGreaterThan(comboFreq(3));
    expect(comboFreq(500)).toBe(comboFreq(1000));
    expect(comboFreq(500)).toBeLessThan(4000);
  });

  it('alarmPeriodMs is null at or below 75%', () => {
    expect(alarmPeriodMs(0)).toBeNull();
    expect(alarmPeriodMs(75)).toBeNull();
  });

  it('alarmPeriodMs shortens as RAM rises and never exceeds 4 pulses/s', () => {
    expect(alarmPeriodMs(76)).toBe(900);
    expect(alarmPeriodMs(100)).toBe(250);
    let prev = Infinity;
    for (let r = 76; r <= 110; r++) {
      const p = alarmPeriodMs(r)!;
      expect(p).toBeLessThanOrEqual(prev);
      expect(p).toBeGreaterThanOrEqual(250);
      prev = p;
    }
  });
});
