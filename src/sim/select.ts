import type { GameState, Win } from './types';

/** Windows containing the point (x, y), topmost (highest z) first. Edges: [x, x+w) × [y, y+h). */
export function windowsUnder(s: GameState, x: number, y: number): Win[] {
  return s.windows
    .filter((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
    .sort((a, b) => b.z - a.z || b.id - a.id);
}
