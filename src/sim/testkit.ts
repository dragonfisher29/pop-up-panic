// Test helpers (pure, deterministic). Used by *.test.ts and the balance bot; not by the game loop.
import { KINDS } from './kinds';
import { createGame, step } from './step';
import type { GameState, Input, PopupKind, Win, WindowPart } from './types';
import { makeCtx, type Draft } from './world';

const NEVER = 1_000_000_000;

/** A game with the spawn director switched off, so tests control every window. */
export function quiet(seed = 1): GameState {
  return { ...createGame(seed), nextSpawnTick: NEVER, nextBurstTick: NEVER };
}

/** Adds a window of `kind` at (x, y) through the normal spawn path (kind init included). */
export function place(s: GameState, kind: PopupKind, x?: number, y?: number): { s: GameState; w: Win } {
  const d: Draft = { ...s, windows: s.windows.slice(), strips: s.strips.slice() };
  const ctx = makeCtx(d, KINDS);
  const w = ctx.spawn(kind, x === undefined || y === undefined ? undefined : { x, y });
  return { s: d, w };
}

/** Steps `n` ticks, sending `inputs` on the first tick only. */
export function advance(s: GameState, n: number, inputs: readonly Input[] = []): GameState {
  let out = s;
  for (let i = 0; i < n; i++) out = step(out, i === 0 ? inputs : []);
  return out;
}

export const click = (id: number, part: WindowPart = 'close'): Input => ({ t: 'click', id, part });

export const byKind = (s: GameState, kind: PopupKind): Win[] => s.windows.filter((w) => w.kind === kind);
