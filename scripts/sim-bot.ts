// Balance bot (PLAN M2): plays SEEDS seeds with the "oldest window, correct counter, 3 clicks/s"
// policy and prints median survival. Target: 90–140 s. Run: npm run sim:bot [-- seeds]
import { botRun } from '../src/sim/bot';
import { TICK_HZ } from '../src/sim/constants';
import { createGame, step } from '../src/sim/step';

declare const process: { argv: string[] }; // no @types/node in this repo

const SEEDS = Number(process.argv[2] ?? 200);
const MAX_TICKS = 600 * TICK_HZ;
const TARGET_MIN_S = 90;
const TARGET_MAX_S = 140;

const secs: number[] = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const s = botRun(seed, MAX_TICKS, createGame, step);
  secs.push((s.crashTick ?? s.tick) / TICK_HZ);
}
secs.sort((a, b) => a - b);
const pct = (p: number) => secs[Math.min(secs.length - 1, Math.floor((p / 100) * secs.length))]!;
const median = pct(50);
const ok = median >= TARGET_MIN_S && median <= TARGET_MAX_S;
console.log(`seeds ${SEEDS}  p10 ${pct(10).toFixed(1)}s  median ${median.toFixed(1)}s  p90 ${pct(90).toFixed(1)}s`);
console.log(`target ${TARGET_MIN_S}-${TARGET_MAX_S}s: ${ok ? 'IN RANGE' : 'OUT OF RANGE'}`);
