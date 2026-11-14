// Daily mode date maths (SPEC §7). Pure: every function takes the time it needs as an argument.
import { DAILY_SEED_PREFIX, hashSeed, LAUNCH_DAY } from '../sim';

const DAY_MS = 86_400_000;

/** UTC day key, for example "2026-11-15". */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The seed everyone gets for a UTC day. */
export function dailySeed(day: string): number {
  return hashSeed(DAILY_SEED_PREFIX + day);
}

function dayIndex(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** Daily number shown in the share text. LAUNCH_DAY is #1. */
export function puzzleNumber(day: string): number {
  return dayIndex(day) - dayIndex(LAUNCH_DAY) + 1;
}

/** Milliseconds until the next UTC midnight (never 0: at midnight it is a full day). */
export function msUntilNextDay(now: Date): number {
  const ms = now.getTime();
  return DAY_MS - (((ms % DAY_MS) + DAY_MS) % DAY_MS);
}

/** "07:12:33". Rounds up so the countdown never shows 00:00:00 before the day turns. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
