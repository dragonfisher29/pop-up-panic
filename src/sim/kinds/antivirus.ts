// antivirus (friendly): every 4 s it closes the oldest hostile window, with a 300 ms tell before
// each bite. Closing it with X costs a +15% RAM spike for 1 s. Its bites don't score.
import { ANTIVIRUS_BITE_TICKS, ANTIVIRUS_PENALTY_TICKS } from '../constants';
import { isHostile, type KindBehaviour } from '../world';

export const antivirus: KindBehaviour = {
  spawn(ctx, w) {
    const at = ctx.s.tick + ANTIVIRUS_BITE_TICKS;
    return { ...w, timerTick: at, tellUntilTick: at };
  },
  onTick(ctx, w) {
    const s = ctx.s;
    if (s.tick < w.timerTick) return;
    let prey = null;
    for (const v of s.windows) {
      if (!isHostile(v)) continue;
      if (!prey || v.bornTick < prey.bornTick || (v.bornTick === prey.bornTick && v.id < prey.id)) prey = v;
    }
    if (prey) ctx.remove([prey.id]);
    const at = s.tick + ANTIVIRUS_BITE_TICKS;
    ctx.patch(w.id, { timerTick: at, tellUntilTick: at });
  },
  onClose(ctx, w) {
    ctx.remove([w.id]);
    ctx.s.spikeUntilTick = ctx.s.tick + ANTIVIRUS_PENALTY_TICKS;
  },
};
