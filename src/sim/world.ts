// Mutation helpers for the per-tick draft. `step` copies the previous state into a Draft first,
// so these may push/splice the draft's arrays, but must REPLACE Win objects, never edit them.
import { COMBO_MAX, COMBO_WINDOW_TICKS, DESKTOP_H, DESKTOP_W, KIND_TUNING, STRIP_H, TASKBAR_H } from './constants';
import { rngInt } from './rng';
import type { GameState, PopupKind, Strip, Win, WindowPart } from './types';

export type Draft = Omit<GameState, 'windows' | 'strips'> & { windows: Win[]; strips: Strip[] };

export interface Ctx {
  readonly s: Draft;
  /** Spawn a window (random spot in the play area unless `at` is given), running the kind's spawn hook. */
  spawn(kind: PopupKind, at?: { x: number; y: number }): Win;
  /** Remove windows without scoring (tricks, antivirus, timers). */
  remove(ids: readonly number[]): void;
  /** Remove windows as one player close action: combo +1 once, points += combo × count. */
  playerClose(ids: readonly number[]): void;
  /** Replace a window with a patched copy. */
  patch(id: number, patch: Partial<Win>): Win | undefined;
  find(id: number): Win | undefined;
  /** Random integer in [min, max], advancing the draft's rng. */
  rand(min: number, max: number): number;
}

export interface KindBehaviour {
  /** Fill kind-specific fields on a freshly spawned window. */
  spawn?(ctx: Ctx, w: Win): Win;
  /** Runs once per tick for each open window of this kind (after inputs). */
  onTick?(ctx: Ctx, w: Win): void;
  /** The X button. Default: a plain player close. */
  onClose?(ctx: Ctx, w: Win): void;
  /** Any other part. Default: nothing. */
  onClick?(ctx: Ctx, w: Win, part: WindowPart): void;
}

export type KindTable = Record<PopupKind, KindBehaviour>;

/** Top edge of the play area (below the toolbar strips). */
export function playTop(s: Pick<GameState, 'strips'>): number {
  return s.strips.length * STRIP_H;
}

/** Bottom edge of the play area (above the taskbar). */
export const PLAY_BOTTOM = DESKTOP_H - TASKBAR_H;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp a window's position into the play area. */
export function clampWin(s: Pick<GameState, 'strips'>, w: Win, x: number, y: number): { x: number; y: number } {
  return { x: clamp(x, 0, DESKTOP_W - w.w), y: clamp(y, playTop(s), Math.max(playTop(s), PLAY_BOTTOM - w.h)) };
}

export function isHostile(w: Win): boolean {
  return w.kind !== 'antivirus';
}

export function makeCtx(s: Draft, kinds: KindTable): Ctx {
  const ctx: Ctx = {
    s,
    rand(min, max) {
      const r = rngInt(s.rng, min, max);
      s.rng = r.state;
      return r.value;
    },
    spawn(kind, at) {
      const tune = KIND_TUNING[kind];
      const top = playTop(s);
      let x: number;
      let y: number;
      if (at) {
        const c = clampWin(s, { w: tune.w, h: tune.h } as Win, at.x, at.y);
        x = c.x;
        y = c.y;
      } else {
        x = ctx.rand(0, DESKTOP_W - tune.w);
        y = ctx.rand(top, Math.max(top, PLAY_BOTTOM - tune.h));
      }
      let w: Win = {
        id: s.nextId,
        kind,
        x,
        y,
        w: tune.w,
        h: tune.h,
        z: s.nextZ,
        bornTick: s.tick,
        ram: tune.ramStart,
        tellUntilTick: 0,
        timerTick: -1,
        stage: 0,
        stageCount: 0,
        link: 0,
      };
      s.nextId += 1;
      s.nextZ += 1;
      const hook = kinds[kind].spawn;
      if (hook) w = hook(ctx, w);
      s.windows.push(w);
      return w;
    },
    remove(ids) {
      if (ids.length === 0) return;
      s.windows = s.windows.filter((w) => !ids.includes(w.id));
    },
    playerClose(ids) {
      const present = ids.filter((id) => s.windows.some((w) => w.id === id));
      if (present.length === 0) return;
      ctx.remove(present);
      s.combo = s.tick - s.lastCloseTick <= COMBO_WINDOW_TICKS ? Math.min(s.combo + 1, COMBO_MAX) : 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.lastCloseTick = s.tick;
      s.closes += present.length;
      s.points += s.combo * present.length;
    },
    patch(id, patch) {
      const idx = s.windows.findIndex((w) => w.id === id);
      if (idx === -1) return undefined;
      const next = { ...s.windows[idx]!, ...patch };
      s.windows[idx] = next;
      return next;
    },
    find(id) {
      return s.windows.find((w) => w.id === id);
    },
  };
  return ctx;
}
