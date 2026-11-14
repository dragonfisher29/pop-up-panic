import { isValidInitials } from '../../src/app/blocklist';

export interface Submission {
  day: string;
  initials: string;
  timeMs: number;
  points: number;
  closes: number;
  inputLog: unknown[][];
}

export type ValidationResult = { ok: true; value: Submission } | { ok: false; error: string };

const MAX_TIME_MS = 600000;
export const MAX_LOG_BYTES = 1024 * 1024;
const MS_PER_TICK = 1000 / 60;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function previousDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

const fail = (error: string): ValidationResult => ({ ok: false, error });
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function validateSubmission(body: unknown, todayUtc: string): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('bad body');
  const b = body as Record<string, unknown>;

  const { day, initials, timeMs, points, closes, inputLog } = b;
  if (typeof day !== 'string' || !DAY_RE.test(day) || (day !== todayUtc && day !== previousDay(todayUtc))) {
    return fail('bad day');
  }
  if (typeof initials !== 'string' || !isValidInitials(initials)) return fail('bad initials');
  if (!isInt(timeMs) || !isInt(points) || !isInt(closes)) return fail('numbers must be integers');
  if (timeMs <= 0 || timeMs > MAX_TIME_MS) return fail('bad time');
  if (points < 0) return fail('bad points');
  if (closes < 0) return fail('bad closes');

  if (!Array.isArray(inputLog) || inputLog.length === 0) return fail('bad input log');
  for (const e of inputLog) {
    if (!Array.isArray(e) || !isInt(e[0])) return fail('bad input log');
  }
  const log = inputLog as unknown[][];
  const lastTick = log[log.length - 1]![0] as number;
  if (lastTick < timeMs / MS_PER_TICK - 2) return fail('log too short');
  if (closes > log.length) return fail('too many closes');
  if (points > closes * 8) return fail('too many points');
  if (JSON.stringify(log).length > MAX_LOG_BYTES) return fail('input log too big');

  return { ok: true, value: { day, initials, timeMs, points, closes, inputLog: log } };
}
