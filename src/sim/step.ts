import {
  COMBO_MAX,
  COMBO_WINDOW_TICKS,
  DESKTOP_H,
  DESKTOP_W,
  HANG_FUSE_TICKS,
  KIND_TUNING,
  RAM_MAX,
  RAM_OS_BASE,
  SPAWN_EASE_TICKS,
  SPAWN_INTERVAL_END_TICKS,
  SPAWN_INTERVAL_START_TICKS,
  TASKBAR_H,
  TICK_HZ,
} from './constants';
import { rngInt } from './rng';
import type { GameState, Input, Win } from './types';

export function createGame(seed: number): GameState {
  return {
    seed: seed >>> 0,
    tick: 0,
    rng: seed >>> 0,
    status: 'running',
    ram: RAM_OS_BASE,
    hangTicks: 0,
    windows: [],
    nextId: 1,
    nextZ: 1,
    nextSpawnTick: 30, // first pop-up after 0.5 s
    closes: 0,
    combo: 0,
    lastCloseTick: -1_000_000,
    points: 0,
    crashTick: null,
  };
}

/** Spawn interval in ticks for a given tick: ease-out from START to END. Integer maths only. */
export function spawnIntervalAt(tick: number): number {
  const t = Math.min(tick, SPAWN_EASE_TICKS);
  // ease-out quad: progress p = 1 - (1 - t/T)^2, computed in integers scaled by T^2
  const T = SPAWN_EASE_TICKS;
  const remaining = T - t;
  const range = SPAWN_INTERVAL_START_TICKS - SPAWN_INTERVAL_END_TICKS;
  const reduction = Math.floor((range * (T * T - remaining * remaining)) / (T * T));
  return SPAWN_INTERVAL_START_TICKS - reduction;
}

/** Advances the game by exactly one tick. Pure: never mutates `prev`. */
export function step(prev: GameState, inputs: readonly Input[]): GameState {
  if (prev.status === 'crashed') return prev;

  const s: GameState = { ...prev, windows: prev.windows.slice() };
  let windows = s.windows as Win[];

  // 1. Inputs
  for (const input of inputs) {
    if (input.t === 'close') {
      const idx = windows.findIndex((w) => w.id === input.id);
      if (idx === -1) continue;
      windows.splice(idx, 1);
      s.combo = s.tick - s.lastCloseTick <= COMBO_WINDOW_TICKS ? Math.min(s.combo + 1, COMBO_MAX) : 1;
      s.lastCloseTick = s.tick;
      s.closes += 1;
      s.points += s.combo;
    }
  }

  // 2. Spawning
  if (s.tick >= s.nextSpawnTick) {
    const tune = KIND_TUNING.ad;
    const rx = rngInt(s.rng, 0, DESKTOP_W - tune.w);
    const ry = rngInt(rx.state, 0, DESKTOP_H - TASKBAR_H - tune.h);
    s.rng = ry.state;
    windows.push({
      id: s.nextId,
      kind: 'ad',
      x: rx.value,
      y: ry.value,
      w: tune.w,
      h: tune.h,
      z: s.nextZ,
      bornTick: s.tick,
      ram: tune.ramStart,
    });
    s.nextId += 1;
    s.nextZ += 1;
    s.nextSpawnTick = s.tick + spawnIntervalAt(s.tick);
  }

  // 3. Leak: every whole second of age, add leakPerSec (capped). Integer-only.
  windows = windows.map((w) => {
    const age = s.tick - w.bornTick;
    if (age <= 0 || age % TICK_HZ !== 0) return w;
    const tune = KIND_TUNING[w.kind];
    const ram = Math.min(w.ram + tune.leakPerSec, tune.ramCap);
    return ram === w.ram ? w : { ...w, ram };
  });
  s.windows = windows;

  // 4. RAM and hang fuse
  s.ram = RAM_OS_BASE + windows.reduce((sum, w) => sum + w.ram, 0);
  s.hangTicks = s.ram >= RAM_MAX ? s.hangTicks + 1 : 0;
  if (s.hangTicks >= HANG_FUSE_TICKS) {
    s.status = 'crashed';
    s.crashTick = s.tick;
  }

  s.tick += 1;
  return s;
}

/** Survival time in whole ms (derived from ticks). */
export function survivalMs(s: GameState): number {
  const ticks = s.crashTick ?? s.tick;
  return Math.floor((ticks * 1000) / TICK_HZ);
}

/** RAM as a whole percent, 0-100+, for display. */
export function ramPercent(s: GameState): number {
  return Math.floor(s.ram / 1000);
}
