import { describe, expect, it } from 'vitest';
import { botInputs } from './bot';
import { TICK_HZ } from './constants';
import { createGame, step } from './step';
import type { GameState, Input } from './types';

const THREE_MIN = 3 * 60 * TICK_HZ;

/** A scripted player that uses every input type: pointer sweeps, drags, counters, both tools. */
function script(s: GameState): Input[] {
  const out: Input[] = [{ t: 'pointer', x: (s.tick * 7) % 1280, y: (s.tick * 3) % 688 }];
  out.push(...botInputs(s));
  const w = s.windows[s.windows.length - 1];
  if (w && s.tick % 45 === 0) out.push({ t: 'focus', id: w.id }, { t: 'drag', id: w.id, dx: 13, dy: -9 });
  if (s.tick % 600 === 300) out.push({ t: 'forceQuit', x: 640, y: 300 });
  if (s.tick === 100 * TICK_HZ) out.push({ t: 'taskManager' });
  return out;
}

function play(seed: number): { s: GameState; log: Input[][] } {
  let s = createGame(seed);
  const log: Input[][] = [];
  for (let i = 0; i < THREE_MIN && s.status === 'running'; i++) {
    const inputs = script(s);
    log.push(inputs);
    s = step(s, inputs);
  }
  return { s, log };
}

describe('determinism', () => {
  it('a 3-minute scripted run is byte-identical on replay of its input log', () => {
    const a = play(2026);
    expect(a.s.tick).toBeGreaterThan(60 * TICK_HZ); // the script survives long enough to see every type
    let b = createGame(2026);
    for (const inputs of a.log) b = step(b, inputs);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a.s));
  });

  it('two fresh runs of the same seed match', () => {
    expect(JSON.stringify(play(77).s)).toBe(JSON.stringify(play(77).s));
  });

  it('keeps every number in state an integer', () => {
    const { s } = play(5);
    const walk = (v: unknown): void => {
      if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(s);
  });
});
