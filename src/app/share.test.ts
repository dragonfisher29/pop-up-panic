import { describe, expect, it } from 'vitest';
import { ramStrip, shareText } from './share';

/** n samples per slice, one RAM value (milli-percent) per slice. */
const run = (perSlice: number, levels: number[]): number[] => levels.flatMap((v) => Array<number>(perSlice).fill(v));

describe('ramStrip', () => {
  it('maps each of 8 slices to its colour by threshold', () => {
    const samples = run(10, [10_000, 49_999, 50_000, 74_999, 75_000, 90_000, 90_001, 100_000]);
    expect(ramStrip(samples, false)).toBe('🟩🟩🟨🟨🟧🟧🟥🟥');
  });

  it('ends in 💥 when the run crashed', () => {
    const samples = run(10, [10_000, 10_000, 60_000, 60_000, 80_000, 95_000, 95_000, 100_000]);
    expect(ramStrip(samples, true)).toBe('🟩🟩🟨🟨🟧🟥🟥💥');
  });

  it('averages the samples inside a slice', () => {
    // slice 0 = [40k, 70k] -> 55k (yellow); every other slice is low
    const samples = [40_000, 70_000, ...Array<number>(14).fill(10_000)];
    expect(ramStrip(samples, false)).toBe('🟨🟩🟩🟩🟩🟩🟩🟩');
  });

  it('splits uneven lengths into equal slices without losing samples', () => {
    const samples = Array.from({ length: 100 }, (_, i) => (i < 50 ? 10_000 : 95_000));
    expect(ramStrip(samples, false)).toBe('🟩🟩🟩🟩🟥🟥🟥🟥');
  });

  it('always has 8 cells, even for very short runs', () => {
    expect([...ramStrip([20_000], true)]).toHaveLength(8);
    expect([...ramStrip([], false)]).toHaveLength(8);
  });
});

describe('shareText', () => {
  it('formats time, closes, combo and the RAM strip', () => {
    expect(shareText({ timeMs: 94_400, closes: 87, bestCombo: 6, strip: '🟩🟩🟨🟨🟧🟥🟥💥' })).toBe(
      'Pop-Up Panic — 1:34 💾 87 closes 🔥x6\n🟩🟩🟨🟨🟧🟥🟥💥',
    );
  });

  it('never shows x0', () => {
    expect(shareText({ timeMs: 5_000, closes: 0, bestCombo: 0, strip: '' })).toBe(
      'Pop-Up Panic — 0:05 💾 0 closes 🔥x1\n',
    );
  });
});
