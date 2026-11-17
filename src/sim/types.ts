// Sim types. Gameplay values are integers only (see docs/ARCHITECTURE.md §2).

export type PopupKind = 'ad' | 'fakeX' | 'runner' | 'prize' | 'virusScan' | 'confirm' | 'toolbar' | 'antivirus';

export interface Win {
  id: number;
  kind: PopupKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  bornTick: number;
  /** milli-percent RAM held by this window */
  ram: number;
  /**
   * Telegraph: the window's trick acts at this tick. The renderer shows the tell while
   * `tick >= tellUntilTick - TELL_TICKS && tick < tellUntilTick`. 0 = no tell pending.
   */
  tellUntilTick: number;
  /** Kind-specific timer tick (prize payout, antivirus next bite). -1 = none. */
  timerTick: number;
  /** Kind-specific stage (runner: 0 calm / 1 alarmed / 2 tired; confirm: chain index). */
  stage: number;
  /** confirm: total stages in this chain. runner: ticks spent fleeing. */
  stageCount: number;
  /** confirm: id of the chain's first window. 0 = none. */
  link: number;
}

/** A toolbar strip attached to the top of the desktop. */
export interface Strip {
  id: number;
  /** index into the strip name list (copy lives in the app) */
  name: number;
}

export type GameStatus = 'running' | 'crashed';

export interface GameState {
  readonly seed: number;
  tick: number;
  rng: number;
  status: GameStatus;
  /** total RAM in milli-percent (OS base + all windows + spike) */
  ram: number;
  /** consecutive ticks at >= RAM_MAX */
  hangTicks: number;
  windows: readonly Win[];
  strips: readonly Strip[];
  nextId: number;
  nextZ: number;
  nextSpawnTick: number;
  /** tick of the next burst */
  nextBurstTick: number;
  /** tick of the next scheduled (friendly) antivirus */
  nextAntivirusTick: number;
  /** windows still to spawn in the current burst */
  burstLeft: number;
  burstNextTick: number;
  closes: number;
  combo: number;
  /** highest combo reached this run (results screen, share text) */
  bestCombo: number;
  lastCloseTick: number;
  points: number;
  crashTick: number | null;
  /** latest pointer sample, integer virtual px */
  pointerX: number;
  pointerY: number;
  forceQuits: number;
  /** tick at which the next Force Quit charge arrives; -1 when full */
  forceQuitRegenTick: number;
  taskManagerUsed: boolean;
  /** Task Manager flash: shown while tick < flashUntilTick */
  flashUntilTick: number;
  flashCount: number;
  /** antivirus-closing penalty: +RAM while tick < spikeUntilTick */
  spikeUntilTick: number;
}

/** Clickable parts of a window (or strip, for 'tray'). */
export type WindowPart = 'close' | 'body' | 'link' | 'cancel' | 'tray';

/** Player inputs for one tick (ARCHITECTURE §3). Coordinates are virtual desktop px. */
export type Input =
  | { t: 'pointer'; x: number; y: number }
  | { t: 'click'; id: number; part: WindowPart }
  | { t: 'focus'; id: number }
  | { t: 'drag'; id: number; dx: number; dy: number }
  | { t: 'forceQuit'; x: number; y: number }
  | { t: 'taskManager' };
