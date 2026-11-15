import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPending,
  loadBest,
  loadInitials,
  loadPending,
  loadSettings,
  saveBest,
  saveInitials,
  savePending,
  saveSettings,
  type RunResult,
} from './storage';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const run = (timeMs: number, points = 10): RunResult => ({ timeMs, points, closes: 5, bestCombo: 3, strip: '🟩💥' });

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));

  it('round-trips settings and keeps unknown keys', () => {
    localStorage.setItem('upp:settings', JSON.stringify({ volume: 0.5 }));
    saveSettings({ mute: true });
    expect(loadSettings()).toEqual({ mute: true });
    expect(JSON.parse(localStorage.getItem('upp:settings')!)).toEqual({ volume: 0.5, mute: true });
  });

  it('keeps the best time, points break ties', () => {
    expect(loadBest()).toBeNull();
    expect(saveBest(run(60_000))).toBe(true);
    expect(saveBest(run(50_000))).toBe(false);
    expect(saveBest(run(60_000, 10))).toBe(false);
    expect(saveBest(run(60_000, 11))).toBe(true);
    expect(loadBest()?.points).toBe(11);
  });

  it('carries over the better of the old Daily / Endless bests', () => {
    localStorage.setItem('upp:best:endless', JSON.stringify(run(40_000)));
    localStorage.setItem('upp:best:daily', JSON.stringify(run(70_000)));
    expect(loadBest()?.timeMs).toBe(70_000);
    expect(saveBest(run(60_000))).toBe(false);
  });

  it('keeps initials and a pending ranked run until cleared', () => {
    expect(loadInitials()).toBeNull();
    saveInitials('NAD');
    expect(loadInitials()).toBe('NAD');
    localStorage.setItem('upp:initials', '"nope"');
    expect(loadInitials()).toBeNull();
    const p = { timeMs: 1000, points: 2, closes: 1, inputLog: [[60, 'end']] };
    savePending(p);
    expect(loadPending()).toEqual(p);
    savePending({ ...p, timeMs: 2000 }); // a newer run replaces the unsent one
    expect(loadPending()?.timeMs).toBe(2000);
    clearPending();
    expect(loadPending()).toBeNull();
  });

  it('ignores corrupt values', () => {
    localStorage.setItem('upp:best', '{not json');
    localStorage.setItem('upp:pending', JSON.stringify({ timeMs: -1, inputLog: [] }));
    expect(loadBest()).toBeNull();
    expect(loadPending()).toBeNull();
  });
});

describe('storage when localStorage throws', () => {
  beforeEach(() => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
  });

  it('never throws and falls back to defaults', () => {
    expect(loadSettings()).toEqual({ mute: false });
    expect(() => saveSettings({ mute: true })).not.toThrow();
    expect(saveBest(run(1))).toBe(true);
    expect(loadInitials()).toBeNull();
    expect(loadPending()).toBeNull();
    expect(() => clearPending()).not.toThrow();
  });
});
