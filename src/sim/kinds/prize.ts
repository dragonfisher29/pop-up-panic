// prize: "YOU WON!" counts down 3 s, then (or on CLAIM) dumps 4 ads and closes.
// The countdown's last 300 ms is the tell (tellUntilTick = payout tick).
import { PRIZE_SPAWNS, PRIZE_TIMER_TICKS } from '../constants';
import type { Win } from '../types';
import type { Ctx, KindBehaviour } from '../world';

function payout(ctx: Ctx, w: Win): void {
  ctx.remove([w.id]);
  for (let i = 0; i < PRIZE_SPAWNS; i++) ctx.spawn('ad');
}

export const prize: KindBehaviour = {
  spawn(ctx, w) {
    const at = ctx.s.tick + PRIZE_TIMER_TICKS;
    return { ...w, timerTick: at, tellUntilTick: at };
  },
  onTick(ctx, w) {
    if (ctx.s.tick >= w.timerTick) payout(ctx, w);
  },
  onClick(ctx, w, part) {
    if (part === 'body') payout(ctx, w);
  },
};
