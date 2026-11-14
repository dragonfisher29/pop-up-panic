import { describe, expect, it } from 'vitest';
import { windowsUnder } from './select';
import { createGame } from './step';
import type { GameState, Win } from './types';

function win(id: number, x: number, y: number, z: number, w = 100, h = 50): Win {
  return { id, kind: 'ad', x, y, w, h, z, bornTick: 0, ram: 0, tellUntilTick: 0, timerTick: -1, stage: 0, stageCount: 0, link: 0 };
}

function withWins(windows: Win[]): GameState {
  return { ...createGame(1), windows };
}

describe('windowsUnder', () => {
  const s = withWins([win(1, 0, 0, 1), win(2, 50, 20, 3), win(3, 500, 500, 2)]);

  it('returns overlapping windows topmost first', () => {
    expect(windowsUnder(s, 60, 30).map((w) => w.id)).toEqual([2, 1]);
  });

  it('includes the top-left edge and excludes the bottom-right edge', () => {
    expect(windowsUnder(s, 0, 0).map((w) => w.id)).toEqual([1]);
    expect(windowsUnder(s, 100, 10).map((w) => w.id)).toEqual([]);
    expect(windowsUnder(s, 99, 49).map((w) => w.id)).toEqual([2, 1]);
  });

  it('breaks equal-z ties by higher id first', () => {
    const tie = withWins([win(4, 0, 0, 5), win(9, 0, 0, 5)]);
    expect(windowsUnder(tie, 1, 1).map((w) => w.id)).toEqual([9, 4]);
  });

  it('returns an empty list for a miss', () => {
    expect(windowsUnder(s, 1000, 10)).toEqual([]);
  });
});
