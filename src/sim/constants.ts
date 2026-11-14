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

/** Tick of the first pop-up (0.5 s). */
export const FIRST_SPAWN_TICK = 30;

/** Spawn interval eases from START to END over EASE_TICKS (ease-out), then holds. */
export const SPAWN_INTERVAL_START_TICKS = 90; // 1500 ms
export const SPAWN_INTERVAL_END_TICKS = 15; // 250 ms
/** SPEC §5 says 150 s; tuned to 120 s so the balance bot median lands in 90–140 s (150 s gave 152 s). */
export const SPAWN_EASE_TICKS = 120 * TICK_HZ;

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
  fakeX: { w: 280, h: 170, ramStart: 4_000, leakPerSec: 500, ramCap: 8_000 },
  runner: { w: 220, h: 140, ramStart: 5_000, leakPerSec: 600, ramCap: 9_000 },
  prize: { w: 300, h: 190, ramStart: 3_000, leakPerSec: 0, ramCap: 3_000 },
  virusScan: { w: 320, h: 180, ramStart: 6_000, leakPerSec: 400, ramCap: 10_000 },
  confirm: { w: 240, h: 120, ramStart: 2_000, leakPerSec: 0, ramCap: 2_000 },
  toolbar: { w: 300, h: 200, ramStart: 3_000, leakPerSec: 0, ramCap: 3_000 },
  antivirus: { w: 240, h: 150, ramStart: 6_000, leakPerSec: 0, ramCap: 6_000 },
} as const satisfies Record<string, KindTuning>;

// ---------- spawn director (SPEC §5) ----------

/** Hostile kinds and the tick they join the weighted pick. Order = unlock order. */
export const UNLOCKS = [
  { kind: 'ad', tick: 0 },
  { kind: 'fakeX', tick: 15 * TICK_HZ },
  { kind: 'runner', tick: 30 * TICK_HZ },
  { kind: 'prize', tick: 45 * TICK_HZ },
  { kind: 'virusScan', tick: 60 * TICK_HZ },
  { kind: 'confirm', tick: 75 * TICK_HZ },
  { kind: 'toolbar', tick: 90 * TICK_HZ },
] as const;

/** Base pick weight per hostile kind. */
export const KIND_WEIGHT = {
  ad: 8,
  fakeX: 10,
  runner: 10,
  prize: 10,
  virusScan: 12,
  confirm: 14,
  toolbar: 12,
} as const;
/** The newest unlocked kind gets this weight multiplier for NEWEST_BOOST_TICKS. */
export const NEWEST_BOOST_MULT = 2;
export const NEWEST_BOOST_TICKS = 10 * TICK_HZ;

/** Antivirus: rolls 1 in ANTIVIRUS_ODDS on each director spawn once unlocked. */
export const ANTIVIRUS_UNLOCK_TICK = 20 * TICK_HZ;
export const ANTIVIRUS_ODDS = 25;

/** Bursts: every BURST_EVERY_TICKS, BURST_MIN..BURST_MAX windows, BURST_GAP_TICKS apart. */
export const BURST_EVERY_TICKS = 25 * TICK_HZ;
export const BURST_MIN = 3;
export const BURST_MAX = 5;
export const BURST_GAP_TICKS = 6; // 5 windows span 24 ticks = 400 ms

/** How long the "NEW THREAT DETECTED" fanfare shows (app reads this). */
export const FANFARE_TICKS = 2 * TICK_HZ;

// ---------- tricks (SPEC §4) ----------

/** Every trick gets a 300 ms tell. */
export const TELL_TICKS = 18;

export const FAKEX_SPAWNS = 1;

export const RUNNER_RADIUS = 90;
export const RUNNER_SPEED = 6;

export const PRIZE_TIMER_TICKS = 3 * TICK_HZ;
export const PRIZE_SPAWNS = 4;

export const VIRUSSCAN_SPAWNS = 2;

export const CONFIRM_MIN_STAGES = 2;
export const CONFIRM_MAX_STAGES = 3;
/** Each follow-up dialog appears this far down-right of the previous one. */
export const CONFIRM_OFFSET = 24;

export const STRIP_H = 40;
export const STRIP_MAX = 4;

export const ANTIVIRUS_BITE_TICKS = 4 * TICK_HZ;
export const ANTIVIRUS_PENALTY_RAM = 15_000;
export const ANTIVIRUS_PENALTY_TICKS = TICK_HZ;

// ---------- panic tools (SPEC §6) ----------

export const FORCE_QUIT_MAX = 3;
export const FORCE_QUIT_REGEN_TICKS = 45 * TICK_HZ;
export const TASK_MANAGER_FLASH_TICKS = 90; // 1.5 s
