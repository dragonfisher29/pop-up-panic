import { describe, expect, it } from 'vitest';
import { DESKTOP_H, DESKTOP_W } from '../sim';
import { POPUP_COPY, pickCopy } from './copy';
import { countUp, fitDesktop, formatClock, toVirtual } from './layout';

describe('fitDesktop', () => {
  it('fills an exact 16:9 viewport with no bars', () => {
    expect(fitDesktop(1920, 1080)).toEqual({ scale: 1.5, left: 0, top: 0 });
  });

  it('letterboxes a tall viewport (bars top and bottom)', () => {
    const f = fitDesktop(1280, 1000);
    expect(f.scale).toBe(1);
    expect(f.left).toBe(0);
    expect(f.top).toBe(140);
  });

  it('pillarboxes a wide viewport (bars left and right)', () => {
    const f = fitDesktop(1366, 600);
    expect(f.scale).toBeCloseTo(600 / 720);
    expect(f.top).toBe(0);
    expect(f.left).toBe(Math.round((1366 - DESKTOP_W * f.scale) / 2));
  });
});

describe('toVirtual', () => {
  const rect = { left: 100, top: 50, width: DESKTOP_W / 2, height: DESKTOP_H / 2 };

  it('maps the corners of the scaled desktop', () => {
    expect(toVirtual(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(toVirtual(100 + DESKTOP_W / 2, 50 + DESKTOP_H / 2, rect)).toEqual({ x: DESKTOP_W, y: DESKTOP_H });
  });

  it('returns integers', () => {
    const p = toVirtual(100.3, 50.7, rect);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });
});

describe('formatClock', () => {
  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(94_133)).toBe('1:34');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('pickCopy', () => {
  it('is stable for the same seed and id', () => {
    expect(pickCopy(42, 7, 'ad')).toBe(pickCopy(42, 7, 'ad'));
  });

  it('uses more than one line across ids', () => {
    const titles = new Set(Array.from({ length: 30 }, (_, i) => pickCopy(42, i, 'ad').title));
    expect(titles.size).toBeGreaterThan(3);
    expect(POPUP_COPY.ad.length).toBe(12);
  });
});

describe('countUp', () => {
  it('starts at 0 and ends exactly on target', () => {
    expect(countUp(137, 0, 800)).toBe(0);
    expect(countUp(137, 800, 800)).toBe(137);
    expect(countUp(137, 5000, 800)).toBe(137);
  });

  it('is an integer, monotonic and eases out', () => {
    let prev = 0;
    for (let ms = 0; ms <= 800; ms += 16) {
      const v = countUp(1000, ms, 800);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(countUp(1000, 400, 800)).toBeGreaterThan(500);
  });
});
