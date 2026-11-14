import { describe, expect, it } from 'vitest';
import { FORCE_QUIT_MAX, FORCE_QUIT_REGEN_TICKS, RAM_OS_BASE, TASK_MANAGER_FLASH_TICKS } from './constants';
import { advance, byKind, place, quiet } from './testkit';
import type { Input } from './types';

const fq = (x: number, y: number): Input => ({ t: 'forceQuit', x, y });

describe('Force Quit', () => {
  it('closes the window under the cursor and skips its trick', () => {
    const a = place(quiet(), 'fakeX', 0, 0);
    const b = place(a.s, 'virusScan', 600, 300);
    let t = advance(b.s, 1, [fq(10, 10)]);
    expect(t.windows.map((w) => w.id)).toEqual([b.w.id]);
    t = advance(t, 1, [fq(610, 310)]);
    expect(t.windows).toHaveLength(0);
    expect(t.closes).toBe(2);
    expect(t.forceQuits).toBe(FORCE_QUIT_MAX - 2);
  });

  it('falls back to the topmost window when nothing is under the cursor', () => {
    const a = place(quiet(), 'ad', 0, 0);
    const b = place(a.s, 'ad', 400, 0);
    const t = advance(b.s, 1, [fq(1000, 600)]);
    expect(t.windows.map((w) => w.id)).toEqual([a.w.id]);
  });

  it('skips the antivirus penalty', () => {
    const { s } = place(quiet(), 'antivirus', 0, 0);
    const t = advance(s, 1, [fq(5, 5)]);
    expect(t.ram).toBe(RAM_OS_BASE);
  });

  it('has 3 charges that regenerate 1 per 45 s up to 3', () => {
    let s = quiet();
    for (let i = 0; i < 5; i++) s = place(s, 'ad', 10 * i, 0).s;
    s = advance(s, 1, [fq(5, 5)]);
    s = advance(s, 1, [fq(5, 5)]);
    s = advance(s, 1, [fq(5, 5)]);
    expect(s.forceQuits).toBe(0);
    const left = s.windows.length;
    s = advance(s, 1, [fq(5, 5)]);
    expect(s.windows).toHaveLength(left); // no charge, nothing happens
    s = advance(s, FORCE_QUIT_REGEN_TICKS);
    expect(s.forceQuits).toBe(1);
    s = advance(s, FORCE_QUIT_REGEN_TICKS * 3);
    expect(s.forceQuits).toBe(FORCE_QUIT_MAX);
    expect(s.forceQuitRegenTick).toBe(-1);
  });
});

describe('Task Manager', () => {
  it('closes every hostile window once per run and flashes the count', () => {
    let s = quiet();
    s = place(s, 'ad', 0, 0).s;
    s = place(s, 'virusScan', 100, 100).s;
    s = place(s, 'fakeX', 200, 200).s;
    s = place(s, 'antivirus', 600, 300).s;
    let t = advance(s, 1, [{ t: 'taskManager' }]);
    expect(t.windows.map((w) => w.kind)).toEqual(['antivirus']);
    expect(byKind(t, 'ad')).toHaveLength(0); // no tricks fired
    expect(t.closes).toBe(3);
    expect(t.flashCount).toBe(3);
    expect(t.flashUntilTick).toBe(s.tick + TASK_MANAGER_FLASH_TICKS);
    expect(t.taskManagerUsed).toBe(true);
    t = place(t, 'ad', 0, 0).s;
    t = advance(t, 1, [{ t: 'taskManager' }]);
    expect(byKind(t, 'ad')).toHaveLength(1);
  });
});
