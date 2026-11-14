import { describe, expect, it } from 'vitest';
import { DESKTOP_H, STRIP_H, STRIP_MAX, TASKBAR_H } from '../constants';
import { advance, click, place, quiet } from '../testkit';
import type { GameState } from '../types';

function install(s: GameState, part: 'close' | 'body' = 'close'): GameState {
  const { s: t, w } = place(s, 'toolbar', 300, 300);
  return advance(t, 1, [click(w.id, part)]);
}

describe('toolbar', () => {
  it('twist: closing the installer (X or Install) attaches a 40 px strip', () => {
    let s = install(quiet(), 'close');
    expect(s.strips).toHaveLength(1);
    expect(s.windows).toHaveLength(0);
    s = install(s, 'body');
    expect(s.strips).toHaveLength(2);
  });

  it('caps at 4 strips', () => {
    let s = quiet();
    for (let i = 0; i < STRIP_MAX + 2; i++) s = install(s);
    expect(s.strips).toHaveLength(STRIP_MAX);
  });

  it('squeezes existing windows and drags below the strips', () => {
    const { s, w } = place(quiet(), 'ad', 50, 0);
    let t = install(s);
    expect(t.windows.find((v) => v.id === w.id)!.y).toBe(STRIP_H);
    t = advance(t, 1, [{ t: 'drag', id: w.id, dx: 0, dy: -500 }]);
    expect(t.windows.find((v) => v.id === w.id)!.y).toBe(STRIP_H);
    t = advance(t, 1, [{ t: 'drag', id: w.id, dx: 0, dy: 5000 }]);
    const ad = t.windows.find((v) => v.id === w.id)!;
    expect(ad.y + ad.h).toBe(DESKTOP_H - TASKBAR_H);
  });

  it('counter: the tray icon uninstalls one strip per click', () => {
    let s = install(install(quiet()));
    const first = s.strips[0]!;
    s = advance(s, 1, [click(first.id, 'tray')]);
    expect(s.strips.map((st) => st.id)).not.toContain(first.id);
    expect(s.strips).toHaveLength(1);
  });
});
