// Share text (SPEC §7). Pure helpers; main.ts does the clipboard / Web Share part.
import { SHARE_ORANGE_RAM, SHARE_RED_RAM, SHARE_SLICES, SHARE_YELLOW_RAM } from '../sim';
import { formatClock } from './layout';

function cell(ram: number): string {
  if (ram > SHARE_RED_RAM) return '🟥';
  if (ram >= SHARE_ORANGE_RAM) return '🟧';
  if (ram >= SHARE_YELLOW_RAM) return '🟨';
  return '🟩';
}

/**
 * RAM level in SHARE_SLICES equal slices of the run: the average RAM (milli-percent) of
 * each slice's per-tick samples. A crashed run ends in 💥 instead of its last slice.
 */
export function ramStrip(samples: readonly number[], crashed: boolean): string {
  const n = samples.length;
  const out: string[] = [];
  for (let i = 0; i < SHARE_SLICES; i++) {
    const a = Math.floor((i * n) / SHARE_SLICES);
    const b = Math.max(a + 1, Math.floor(((i + 1) * n) / SHARE_SLICES));
    let sum = 0;
    let count = 0;
    for (let j = a; j < b && j < n; j++) {
      sum += samples[j]!;
      count++;
    }
    out.push(cell(count === 0 ? 0 : sum / count));
  }
  if (crashed) out[SHARE_SLICES - 1] = '💥';
  return out.join('');
}

export interface ShareRun {
  timeMs: number;
  closes: number;
  bestCombo: number;
  strip: string;
}

/** "Pop-Up Panic — 1:34 💾 87 closes 🔥x6" + newline + the RAM strip. */
export function shareText(r: ShareRun): string {
  return `Pop-Up Panic — ${formatClock(r.timeMs)} 💾 ${r.closes} closes 🔥x${Math.max(1, r.bestCombo)}\n${r.strip}`;
}
