// Spawn director (SPEC §5): eased interval, unlock waves, weighted picks, bursts, scheduled antivirus.
import {
  ANTIVIRUS_EVERY_TICKS,
  BURST_EVERY_TICKS,
  BURST_GAP_TICKS,
  BURST_MAX,
  BURST_MIN,
  KIND_WEIGHT,
  NEWEST_BOOST_MULT,
  NEWEST_BOOST_TICKS,
  SPAWN_EASE_TICKS,
  SPAWN_INTERVAL_END_TICKS,
  SPAWN_INTERVAL_START_TICKS,
  UNLOCKS,
} from './constants';
import { rngInt } from './rng';
import type { PopupKind } from './types';
import type { Ctx } from './world';

type HostileKind = (typeof UNLOCKS)[number]['kind'];

/** Spawn interval in ticks for a given tick: ease-out from START to END. Integer maths only. */
export function spawnIntervalAt(tick: number): number {
  const t = Math.min(tick, SPAWN_EASE_TICKS);
  // ease-out quad: progress p = 1 - (1 - t/T)^2, computed in integers scaled by T^2
  const T = SPAWN_EASE_TICKS;
  const remaining = T - t;
  const range = SPAWN_INTERVAL_START_TICKS - SPAWN_INTERVAL_END_TICKS;
  const reduction = Math.floor((range * (T * T - remaining * remaining)) / (T * T));
  return SPAWN_INTERVAL_START_TICKS - reduction;
}

/** Hostile kinds unlocked at `tick`, in unlock order. */
export function unlockedKinds(tick: number): HostileKind[] {
  return UNLOCKS.filter((u) => u.tick <= tick).map((u) => u.kind);
}

/** The most recent unlock at or before `tick` (for the wave fanfare). */
export function latestUnlock(tick: number): { kind: HostileKind; tick: number } {
  let last: { kind: HostileKind; tick: number } = UNLOCKS[0];
  for (const u of UNLOCKS) if (u.tick <= tick) last = u;
  return last;
}

export function kindWeights(tick: number): { kind: HostileKind; weight: number }[] {
  const newest = latestUnlock(tick);
  const boosted = newest.tick > 0 && tick - newest.tick < NEWEST_BOOST_TICKS;
  return unlockedKinds(tick).map((kind) => ({
    kind,
    weight: KIND_WEIGHT[kind] * (boosted && kind === newest.kind ? NEWEST_BOOST_MULT : 1),
  }));
}

/** Pure weighted pick of a hostile kind. The antivirus is never picked here: it has its own schedule. */
export function pickKind(rng: number, tick: number): { kind: PopupKind; rng: number } {
  const weights = kindWeights(tick);
  const total = weights.reduce((sum, k) => sum + k.weight, 0);
  const r = rngInt(rng, 0, total - 1);
  let acc = 0;
  for (const k of weights) {
    acc += k.weight;
    if (r.value < acc) return { kind: k.kind, rng: r.state };
  }
  return { kind: weights[weights.length - 1]!.kind, rng: r.state };
}

function spawnPicked(ctx: Ctx): void {
  const p = pickKind(ctx.s.rng, ctx.s.tick);
  ctx.s.rng = p.rng;
  ctx.spawn(p.kind);
}

/** Runs the director for this tick: the scheduled antivirus, regular spawns, and bursts. */
export function directorTick(ctx: Ctx): void {
  const s = ctx.s;
  if (s.tick >= s.nextAntivirusTick) {
    ctx.spawn('antivirus');
    s.nextAntivirusTick += ANTIVIRUS_EVERY_TICKS;
  }
  if (s.tick >= s.nextSpawnTick) {
    spawnPicked(ctx);
    s.nextSpawnTick = s.tick + spawnIntervalAt(s.tick);
  }
  if (s.tick >= s.nextBurstTick) {
    s.burstLeft = ctx.rand(BURST_MIN, BURST_MAX);
    s.burstNextTick = s.tick;
    s.nextBurstTick += BURST_EVERY_TICKS;
  }
  if (s.burstLeft > 0 && s.tick >= s.burstNextTick) {
    spawnPicked(ctx);
    s.burstLeft -= 1;
    s.burstNextTick = s.tick + BURST_GAP_TICKS;
  }
}
