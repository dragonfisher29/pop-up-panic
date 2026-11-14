// Pure diff of two GameStates into app-layer effect events (no DOM, never writes sim state).
import { latestUnlock, type GameState, type PopupKind } from '../sim';

export type FxEvent =
  | { t: 'spawn'; kind: PopupKind; id: number }
  | { t: 'close'; id: number; kind: PopupKind; x: number; y: number; w: number; h: number }
  | { t: 'combo'; n: number }
  | { t: 'wave'; kind: PopupKind }
  | { t: 'forceQuit' }
  | { t: 'taskManager' }
  | { t: 'crash' };

export function fxEvents(prev: GameState, next: GameState): FxEvent[] {
  const out: FxEvent[] = [];
  const prevIds = new Set(prev.windows.map((w) => w.id));
  const nextIds = new Set(next.windows.map((w) => w.id));

  for (const w of next.windows) if (!prevIds.has(w.id)) out.push({ t: 'spawn', kind: w.kind, id: w.id });
  for (const w of prev.windows) {
    if (!nextIds.has(w.id)) out.push({ t: 'close', id: w.id, kind: w.kind, x: w.x, y: w.y, w: w.w, h: w.h });
  }
  if (next.combo > prev.combo && next.combo >= 2) out.push({ t: 'combo', n: next.combo });

  const a = latestUnlock(prev.tick);
  const b = latestUnlock(next.tick);
  if (b.tick !== a.tick && b.tick > 0) out.push({ t: 'wave', kind: b.kind });

  if (next.forceQuits < prev.forceQuits) out.push({ t: 'forceQuit' });
  if (next.taskManagerUsed && !prev.taskManagerUsed) out.push({ t: 'taskManager' });
  if (prev.status === 'running' && next.status === 'crashed') out.push({ t: 'crash' });
  return out;
}
