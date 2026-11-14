import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPending,
  loadBest,
  loadDaily,
  loadInitials,
  loadPending,
  loadSettings,
  saveBest,
  saveDailyIfFirst,
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

  it('ranks only the first daily run of a day', () => {
    expect(loadDaily('2026-11-15')).toBeNull();
    expect(saveDailyIfFirst({ day: '2026-11-15', ...run(90_000) })).toBe(true);
    expect(saveDailyIfFirst({ day: '2026-11-15', ...run(200_000) })).toBe(false);
    expect(loadDaily('2026-11-15')?.timeMs).toBe(90_000);
    expect(saveDailyIfFirst({ day: '2026-11-16', ...run(50_000) })).toBe(true);
  });

  it('keeps the best time per mode, points break ties', () => {
    expect(saveBest('endless', run(60_000))).toBe(true);
    expect(saveBest('endless', run(50_000))).toBe(false);
    expect(saveBest('endless', run(60_000, 10))).toBe(false);
    expect(saveBest('endless', run(60_000, 11))).toBe(true);
    expect(loadBest('endless')?.points).toBe(11);
    expect(loadBest('daily')).toBeNull();
  });

  it('keeps initials and a pending ranked run until cleared', () => {
    expect(loadInitials()).toBeNull();
    saveInitials('NAD');
    expect(loadInitials()).toBe('NAD');
    localStorage.setItem('upp:initials', '"nope"');
    expect(loadInitials()).toBeNull();
    const p = { day: '2026-11-15', timeMs: 1000, points: 2, closes: 1, inputLog: [[60, 'end']] };
    savePending(p);
    expect(loadPending('2026-11-15')).toEqual(p);
    clearPending('2026-11-15');
    expect(loadPending('2026-11-15')).toBeNull();
  });

  it('ignores corrupt values', () => {
    localStorage.setItem('upp:best:endless', '{not json');
    localStorage.setItem('upp:daily:2026-11-15', JSON.stringify({ timeMs: -1 }));
    expect(loadBest('endless')).toBeNull();
    expect(loadDaily('2026-11-15')).toBeNull();
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
    expect(loadDaily('2026-11-15')).toBeNull();
    expect(saveDailyIfFirst({ day: '2026-11-15', ...run(1) })).toBe(true);
    expect(saveBest('endless', run(1))).toBe(true);
    expect(loadInitials()).toBeNull();
    expect(() => clearPending('2026-11-15')).not.toThrow();
  });
});
