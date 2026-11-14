// confirm: "Close window?" -> "Really?" -> "Final answer?" (a chain of 2–3 dialogs).
// X or Yes on the newest dialog opens the next one; Yes on the last closes the whole chain.
// No does nothing. Older dialogs in the chain ignore clicks.
import { CONFIRM_MAX_STAGES, CONFIRM_MIN_STAGES, CONFIRM_OFFSET } from '../constants';
import type { Win } from '../types';
import type { Ctx, KindBehaviour } from '../world';

function advanceChain(ctx: Ctx, w: Win): void {
  const chain = ctx.s.windows.filter((v) => v.kind === 'confirm' && v.link === w.link);
  if (chain.some((v) => v.stage > w.stage)) return; // only the newest dialog acts
  if (w.stage >= w.stageCount - 1) {
    ctx.playerClose(chain.map((v) => v.id));
    return;
  }
  const next = ctx.spawn('confirm', { x: w.x + CONFIRM_OFFSET, y: w.y + CONFIRM_OFFSET });
  ctx.patch(next.id, { stage: w.stage + 1, stageCount: w.stageCount, link: w.link });
}

export const confirm: KindBehaviour = {
  spawn(ctx, w) {
    return { ...w, stage: 0, stageCount: ctx.rand(CONFIRM_MIN_STAGES, CONFIRM_MAX_STAGES), link: w.id };
  },
  onClose: advanceChain,
  onClick(ctx, w, part) {
    if (part === 'body') advanceChain(ctx, w);
  },
};
