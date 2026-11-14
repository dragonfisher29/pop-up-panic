// fakeX: the big X is fake and spawns an ad. The small "no thanks" link is the real close.
import { FAKEX_SPAWNS } from '../constants';
import type { KindBehaviour } from '../world';

export const fakeX: KindBehaviour = {
  onClose(ctx) {
    for (let i = 0; i < FAKEX_SPAWNS; i++) ctx.spawn('ad');
  },
  onClick(ctx, w, part) {
    if (part === 'link') ctx.playerClose([w.id]);
  },
};
