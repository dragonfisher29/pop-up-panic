import {
  ANTIVIRUS_PENALTY_RAM,
  BURST_EVERY_TICKS,
  DESKTOP_H,
  DESKTOP_W,
  FIRST_SPAWN_TICK,
  FORCE_QUIT_MAX,
  FORCE_QUIT_REGEN_TICKS,
  HANG_FUSE_TICKS,
  KIND_TUNING,
  RAM_MAX,
  RAM_OS_BASE,
  TASK_MANAGER_FLASH_TICKS,
  TICK_HZ,
} from './constants';
import { directorTick } from './director';
import { KINDS } from './kinds';
import { uninstallStrip } from './kinds/toolbar';
import { windowsUnder } from './select';
import type { GameState, Input } from './types';
import { clamp, clampWin, isHostile, makeCtx, type Ctx, type Draft } from './world';

export { spawnIntervalAt } from './director';

export function createGame(seed: number): GameState {
  return {
    seed: seed >>> 0,
    tick: 0,
    rng: seed >>> 0,
    status: 'running',
    ram: RAM_OS_BASE,
    hangTicks: 0,
    windows: [],
    strips: [],
    nextId: 1,
    nextZ: 1,
    nextSpawnTick: FIRST_SPAWN_TICK,
    nextBurstTick: BURST_EVERY_TICKS,
    burstLeft: 0,
    burstNextTick: 0,
    closes: 0,
    combo: 0,
    bestCombo: 0,
    lastCloseTick: -1_000_000,
    points: 0,
    crashTick: null,
    pointerX: DESKTOP_W >> 1,
    pointerY: DESKTOP_H >> 1,
    forceQuits: FORCE_QUIT_MAX,
    forceQuitRegenTick: -1,
    taskManagerUsed: false,
    flashUntilTick: 0,
    flashCount: 0,
    spikeUntilTick: 0,
  };
}

/** Input number -> integer. NaN and ±Infinity become 0 so bad input can never poison state. */
function toInt(v: number): number {
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

function applyInput(ctx: Ctx, input: Input): void {
  const s = ctx.s;
  switch (input.t) {
    case 'pointer':
      s.pointerX = clamp(toInt(input.x), 0, DESKTOP_W - 1);
      s.pointerY = clamp(toInt(input.y), 0, DESKTOP_H - 1);
      break;
    case 'focus': {
      const w = ctx.find(input.id);
      if (!w) break;
      const topZ = s.windows.reduce((m, v) => (v.z > m ? v.z : m), 0);
      if (w.z === topZ) break;
      ctx.patch(w.id, { z: s.nextZ });
      s.nextZ += 1;
      break;
    }
    case 'drag': {
      const w = ctx.find(input.id);
      if (!w) break;
      const c = clampWin(s, w, w.x + toInt(input.dx), w.y + toInt(input.dy));
      if (c.x !== w.x || c.y !== w.y) ctx.patch(w.id, c);
      break;
    }
    case 'click': {
      if (input.part === 'tray') {
        if (uninstallStrip(ctx, input.id)) break;
      }
      const w = ctx.find(input.id);
      if (!w) break;
      const kind = KINDS[w.kind];
      if (input.part === 'close') {
        if (kind.onClose) kind.onClose(ctx, w);
        else ctx.playerClose([w.id]);
      } else {
        kind.onClick?.(ctx, w, input.part);
      }
      break;
    }
    case 'forceQuit': {
      if (s.forceQuits <= 0 || s.windows.length === 0) break;
      const under = windowsUnder(s, toInt(input.x), toInt(input.y));
      const target = under[0] ?? s.windows.reduce((a, b) => (b.z > a.z ? b : a));
      ctx.playerClose([target.id]);
      s.forceQuits -= 1;
      if (s.forceQuitRegenTick === -1) s.forceQuitRegenTick = s.tick + FORCE_QUIT_REGEN_TICKS;
      break;
    }
    case 'taskManager': {
      if (s.taskManagerUsed) break;
      const ids = s.windows.filter(isHostile).map((w) => w.id);
      s.taskManagerUsed = true;
      s.flashUntilTick = s.tick + TASK_MANAGER_FLASH_TICKS;
      s.flashCount = ids.length;
      ctx.playerClose(ids);
      break;
    }
  }
}

/** Advances the game by exactly one tick. Pure: never mutates `prev`. */
export function step(prev: GameState, inputs: readonly Input[]): GameState {
  if (prev.status === 'crashed') return prev;

  const s: Draft = { ...prev, windows: prev.windows.slice(), strips: prev.strips.slice() };
  const ctx = makeCtx(s, KINDS);

  // 1. Inputs (applied in order, before spawning and leaking)
  for (const input of inputs) applyInput(ctx, input);

  // 2. Kind behaviours, in id order of the windows open now
  for (const id of s.windows.map((w) => w.id)) {
    const w = ctx.find(id);
    if (w) KINDS[w.kind].onTick?.(ctx, w);
  }

  // 3. Spawning
  directorTick(ctx);

  // 4. Keep every window inside the play area (strips may have shrunk it)
  for (const w of s.windows) {
    const c = clampWin(s, w, w.x, w.y);
    if (c.x !== w.x || c.y !== w.y) ctx.patch(w.id, c);
  }

  // 5. Leak: every whole second of age, add leakPerSec (capped). Integer-only.
  s.windows = s.windows.map((w) => {
    const age = s.tick - w.bornTick;
    if (age <= 0 || age % TICK_HZ !== 0) return w;
    const tune = KIND_TUNING[w.kind];
    const ram = Math.min(w.ram + tune.leakPerSec, tune.ramCap);
    return ram === w.ram ? w : { ...w, ram };
  });

  // 6. Force Quit regen
  if (s.forceQuitRegenTick !== -1 && s.tick >= s.forceQuitRegenTick) {
    s.forceQuits = Math.min(s.forceQuits + 1, FORCE_QUIT_MAX);
    s.forceQuitRegenTick = s.forceQuits < FORCE_QUIT_MAX ? s.tick + FORCE_QUIT_REGEN_TICKS : -1;
  }

  // 7. RAM and hang fuse
  const spike = s.tick < s.spikeUntilTick ? ANTIVIRUS_PENALTY_RAM : 0;
  s.ram = RAM_OS_BASE + spike + s.windows.reduce((sum, w) => sum + w.ram, 0);
  s.hangTicks = s.ram >= RAM_MAX ? s.hangTicks + 1 : 0;
  if (s.hangTicks >= HANG_FUSE_TICKS) {
    s.status = 'crashed';
    s.crashTick = s.tick;
  }

  s.tick += 1;
  return s;
}

/** Survival time in whole ms (derived from ticks). */
export function survivalMs(s: GameState): number {
  const ticks = s.crashTick ?? s.tick;
  return Math.floor((ticks * 1000) / TICK_HZ);
}

/** RAM as a whole percent, 0-100+, for display. */
export function ramPercent(s: GameState): number {
  return Math.floor(s.ram / 1000);
}
