// Sim types. Gameplay values are integers only (see docs/ARCHITECTURE.md §2).

/** Grows to all 8 kinds in M2: 'ad' | 'fakeX' | 'runner' | 'prize' | 'virusScan' | 'confirm' | 'toolbar' | 'antivirus' */
export type PopupKind = 'ad';

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
}

export type GameStatus = 'running' | 'crashed';

export interface GameState {
  readonly seed: number;
  tick: number;
  rng: number;
  status: GameStatus;
  /** total RAM in milli-percent (OS base + all windows) */
  ram: number;
  /** consecutive ticks at >= RAM_MAX */
  hangTicks: number;
  windows: readonly Win[];
  nextId: number;
  nextZ: number;
  nextSpawnTick: number;
  closes: number;
  combo: number;
  lastCloseTick: number;
  points: number;
  crashTick: number | null;
  /** latest pointer sample, integer virtual px (the M2 runner reads it) */
  pointerX: number;
  pointerY: number;
}

/** Clickable parts of a window. M1 only acts on 'close'; the rest arrive with M2 kinds. */
export type WindowPart = 'close' | 'body' | 'link' | 'cancel' | 'tray';

/** Player inputs for one tick (ARCHITECTURE §3). Coordinates are virtual desktop px. */
export type Input =
  | { t: 'pointer'; x: number; y: number }
  | { t: 'click'; id: number; part: WindowPart }
  | { t: 'focus'; id: number }
  | { t: 'drag'; id: number; dx: number; dy: number };
