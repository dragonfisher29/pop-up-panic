// toolbar: closing the installer (X or Install) attaches a strip to the top of the desktop.
import type { Ctx, KindBehaviour } from '../world';

/** Removes the strip with this id. Returns false if there is no such strip. */
export function uninstallStrip(ctx: Ctx, id: number): boolean {
  const idx = ctx.s.strips.findIndex((st) => st.id === id);
  if (idx === -1) return false;
  ctx.s.strips.splice(idx, 1);
  return true;
}

export const toolbar: KindBehaviour = {};
