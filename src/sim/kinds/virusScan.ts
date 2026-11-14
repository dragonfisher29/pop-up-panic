// virusScan: closing with X spawns two more scans. "Cancel scan" is the real close.
import { VIRUSSCAN_SPAWNS } from '../constants';
import type { KindBehaviour } from '../world';

export const virusScan: KindBehaviour = {
  onClose(ctx, w) {
    ctx.playerClose([w.id]);
    for (let i = 0; i < VIRUSSCAN_SPAWNS; i++) ctx.spawn('virusScan');
  },
  onClick(ctx, w, part) {
    if (part === 'cancel') ctx.playerClose([w.id]);
  },
};
