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
}

/** M0 starter input. In M1 this becomes { t: 'click'; id; part: 'close' } and the other inputs in ARCHITECTURE §3. */
export type Input = { t: 'close'; id: number };
