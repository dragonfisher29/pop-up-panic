// Every tuning number lives here. Units: ticks (60/s), px (virtual 1280x720), RAM in milli-percent (100_000 = 100%).
// Starting values come from docs/SPEC.md. Tune them in M2 using the balance bot and playtests.

export const TICK_HZ = 60;
export const MS_PER_TICK = 1000 / TICK_HZ; // display only; gameplay uses ticks

export const DESKTOP_W = 1280;
export const DESKTOP_H = 720;
export const TASKBAR_H = 32;

export const RAM_MAX = 100_000;
export const RAM_OS_BASE = 10_000; // 10%

/** Ticks spent at >= 100% RAM before crashing (2 s). */
export const HANG_FUSE_TICKS = 2 * TICK_HZ;

/** Spawn interval eases from START to END over EASE_TICKS (ease-out), then holds. */
export const SPAWN_INTERVAL_START_TICKS = 90; // 1500 ms
export const SPAWN_INTERVAL_END_TICKS = 15; // 250 ms
export const SPAWN_EASE_TICKS = 150 * TICK_HZ;

/** Combo: a close within this many ticks of the previous close raises the combo. */
export const COMBO_WINDOW_TICKS = 36; // 600 ms
export const COMBO_MAX = 8;

export interface KindTuning {
  w: number;
  h: number;
  /** milli-percent at spawn */
  ramStart: number;
  /** milli-percent added per second while open */
  leakPerSec: number;
  /** milli-percent ceiling */
  ramCap: number;
}

export const KIND_TUNING = {
  ad: { w: 260, h: 160, ramStart: 4_000, leakPerSec: 500, ramCap: 8_000 },
} as const satisfies Record<string, KindTuning>;
