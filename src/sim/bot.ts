// Balance-bot policy (PLAN M2): every CLICK_EVERY ticks, act on the oldest hostile thing with its
// correct counter. Pure, so the determinism test and scripts/sim-bot.ts share it.
import type { GameState, Input, Win, WindowPart } from './types';
import { isHostile } from './world';

/** 3 clicks per second. */
export const BOT_CLICK_EVERY = 20;

const COUNTER: Record<Win['kind'], WindowPart> = {
  ad: 'close',
  fakeX: 'link',
  runner: 'close',
  prize: 'close',
  virusScan: 'cancel',
  confirm: 'body',
  toolbar: 'close',
  antivirus: 'close', // never used: the bot leaves antivirus alone
};

export function botInputs(s: GameState): Input[] {
  if (s.tick % BOT_CLICK_EVERY !== 0) return [];
  let target: Win | null = null;
  for (const w of s.windows) {
    if (!isHostile(w)) continue;
    if (!target || w.bornTick < target.bornTick || (w.bornTick === target.bornTick && w.id < target.id)) target = w;
  }
  const strip = s.strips[0];
  if (strip && (!target || strip.id < target.id)) return [{ t: 'click', id: strip.id, part: 'tray' }];
  if (!target) return [];
  if (target.kind === 'confirm') {
    // act on the newest dialog of the chain
    const link = target.link;
    target = s.windows.filter((w) => w.kind === 'confirm' && w.link === link).reduce((a, b) => (b.stage > a.stage ? b : a));
  }
  return [{ t: 'click', id: target.id, part: COUNTER[target.kind] }];
}

/** Plays one seed to the crash (or maxTicks). Returns survival in ticks. */
export function botRun(
  seed: number,
  maxTicks: number,
  create: (seed: number) => GameState,
  stepFn: (s: GameState, i: readonly Input[]) => GameState,
): GameState {
  let s = create(seed);
  while (s.status === 'running' && s.tick < maxTicks) s = stepFn(s, botInputs(s));
  return s;
}
