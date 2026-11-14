// Deterministic RNG: mulberry32. The state is a single uint32 stored in GameState.rng.
// Pure-functional: rngNext returns the value AND the next state. Never use Math.random in src/sim.

export interface RngResult {
  /** uint32 in [0, 2^32) */
  value: number;
  state: number;
}

export function rngNext(state: number): RngResult {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, state: s };
}

/** Integer in [min, max] inclusive. */
export function rngInt(state: number, min: number, max: number): { value: number; state: number } {
  if (max < min) throw new Error(`rngInt: max ${max} < min ${min}`);
  const r = rngNext(state);
  const span = max - min + 1;
  return { value: min + (r.value % span), state: r.state };
}

/** FNV-1a 32-bit hash: turns strings (for example "popup-panic:2026-11-15") into seeds. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
