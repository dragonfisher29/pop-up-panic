// runner: slides away when the cursor comes within RUNNER_RADIUS px, at RUNNER_SPEED px/tick,
// bounded by the play area. The first time it notices the cursor its title bar flashes for
// TELL_TICKS (stage 0 -> 1) before it moves. Counter: trap it in a corner, or Force Quit.
import { RUNNER_RADIUS, RUNNER_SPEED, TELL_TICKS } from '../constants';
import type { Win } from '../types';
import { clampWin, type KindBehaviour } from '../world';

/** Squared distance from (px, py) to the window rectangle (0 when inside). */
function dist2(w: Win, px: number, py: number): number {
  const dx = px < w.x ? w.x - px : px >= w.x + w.w ? px - (w.x + w.w - 1) : 0;
  const dy = py < w.y ? w.y - py : py >= w.y + w.h ? py - (w.y + w.h - 1) : 0;
  return dx * dx + dy * dy;
}

export const runner: KindBehaviour = {
  onTick(ctx, w) {
    const s = ctx.s;
    if (dist2(w, s.pointerX, s.pointerY) > RUNNER_RADIUS * RUNNER_RADIUS) return;
    if (w.stage === 0) {
      ctx.patch(w.id, { stage: 1, tellUntilTick: s.tick + TELL_TICKS });
      return;
    }
    if (s.tick < w.tellUntilTick) return;
    // Flee along the line from the cursor to the window centre (Chebyshev-normalised, integers only).
    let dx = w.x + (w.w >> 1) - s.pointerX;
    let dy = w.y + (w.h >> 1) - s.pointerY;
    if (dx === 0 && dy === 0) dx = 1;
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    const mx = Math.trunc((dx * RUNNER_SPEED) / m);
    const my = Math.trunc((dy * RUNNER_SPEED) / m);
    const c = clampWin(s, w, w.x + mx, w.y + my);
    if (c.x !== w.x || c.y !== w.y) ctx.patch(w.id, c);
  },
};
