// toolbar: closing the installer (X or Install) attaches a 40 px strip to the top of the desktop,
// up to STRIP_MAX. Strips shrink the play area (step re-clamps windows every tick).
// Counter: click a strip's tray icon to uninstall it.
import { STRIP_MAX, STRIP_NAME_COUNT } from '../constants';
import type { Win } from '../types';
import type { Ctx, KindBehaviour } from '../world';

/** Removes the strip with this id. Returns false if there is no such strip. */
export function uninstallStrip(ctx: Ctx, id: number): boolean {
  const idx = ctx.s.strips.findIndex((st) => st.id === id);
  if (idx === -1) return false;
  ctx.s.strips.splice(idx, 1);
  return true;
}

function install(ctx: Ctx, w: Win): void {
  ctx.playerClose([w.id]);
  const s = ctx.s;
  if (s.strips.length >= STRIP_MAX) return;
  s.strips.push({ id: s.nextId, name: ctx.rand(0, STRIP_NAME_COUNT - 1) });
  s.nextId += 1;
}

export const toolbar: KindBehaviour = {
  onClose: install,
  onClick(ctx, w, part) {
    if (part === 'body') install(ctx, w);
  },
};
