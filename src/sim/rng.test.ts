import { describe, expect, it } from 'vitest';
import { hashSeed, rngInt, rngNext } from './rng';

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const seq = (seed: number) => {
      let s = seed;
      const out: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = rngNext(s);
        out.push(r.value);
        s = r.state;
      }
      return out;
    };
    expect(seq(42)).toEqual(seq(42));
    expect(seq(42)).not.toEqual(seq(43));
  });

  it('rngInt stays within inclusive bounds', () => {
    let s = 7;
    for (let i = 0; i < 2000; i++) {
      const r = rngInt(s, 3, 9);
      expect(r.value).toBeGreaterThanOrEqual(3);
      expect(r.value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(r.value)).toBe(true);
      s = r.state;
    }
  });

  it('hashSeed is stable and differs per day', () => {
    expect(hashSeed('popup-panic:2026-11-15')).toBe(hashSeed('popup-panic:2026-11-15'));
    expect(hashSeed('popup-panic:2026-11-15')).not.toBe(hashSeed('popup-panic:2026-11-16'));
  });
});
