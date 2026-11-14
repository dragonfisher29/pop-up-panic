// localStorage wrapper. Every access is in try/catch: private windows and blocked storage must not break the game.
// Keys (ARCHITECTURE §7): upp:settings · upp:daily:<day> · upp:best:endless · upp:best:daily · upp:initials · upp:pending:<day>

export interface Settings {
  mute: boolean;
}

/** A finished run, as stored and as shown on the results screen. */
export interface RunResult {
  timeMs: number;
  points: number;
  closes: number;
  bestCombo: number;
  /** RAM strip emoji (share text) */
  strip: string;
}

export interface DailyResult extends RunResult {
  day: string;
}

export type BestMode = 'endless' | 'daily';

const SETTINGS_KEY = 'upp:settings';
const DEFAULTS: Settings = { mute: false };

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: it lasts for this visit only
  }
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function asRun(v: unknown): RunResult | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isCount(o.timeMs) || !isCount(o.points) || !isCount(o.closes)) return null;
  return {
    timeMs: o.timeMs,
    points: o.points,
    closes: o.closes,
    bestCombo: isCount(o.bestCombo) ? o.bestCombo : 0,
    strip: typeof o.strip === 'string' ? o.strip : '',
  };
}

export function loadSettings(): Settings {
  const parsed = read(SETTINGS_KEY) as Partial<Settings> | null;
  return { mute: parsed?.mute === true };
}

export function saveSettings(s: Settings): void {
  const prev = read(SETTINGS_KEY);
  write(SETTINGS_KEY, { ...(typeof prev === 'object' && prev !== null ? prev : {}), ...s });
}

/** Today's ranked result, or null if the ranked run hasn't been played yet. */
export function loadDaily(day: string): DailyResult | null {
  const run = asRun(read(`upp:daily:${day}`));
  return run ? { ...run, day } : null;
}

/** Stores `r` as the day's ranked result if there isn't one yet. Returns true if `r` is the ranked run. */
export function saveDailyIfFirst(r: DailyResult): boolean {
  if (loadDaily(r.day)) return false;
  write(`upp:daily:${r.day}`, r);
  return true;
}

export function loadBest(mode: BestMode): RunResult | null {
  return asRun(read(`upp:best:${mode}`));
}

export function loadInitials(): string | null {
  const v = read('upp:initials');
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : null;
}

export function saveInitials(s: string): void {
  write('upp:initials', s);
}

/** The day's ranked run waiting to be sent (set at crash, cleared once the server accepts it). */
export interface PendingRun {
  day: string;
  timeMs: number;
  points: number;
  closes: number;
  inputLog: (number | string)[][];
}

export function loadPending(day: string): PendingRun | null {
  const v = read(`upp:pending:${day}`) as PendingRun | null;
  return v && typeof v === 'object' && Array.isArray(v.inputLog) && isCount(v.timeMs) ? { ...v, day } : null;
}

export function savePending(r: PendingRun): void {
  write(`upp:pending:${r.day}`, r);
}

export function clearPending(day: string): void {
  try {
    localStorage.removeItem(`upp:pending:${day}`);
  } catch {
    // storage unavailable
  }
}

/** Keeps the longer run (points break ties). Returns true if `r` is a new best. */
export function saveBest(mode: BestMode, r: RunResult): boolean {
  const prev = loadBest(mode);
  if (prev && (prev.timeMs > r.timeMs || (prev.timeMs === r.timeMs && prev.points >= r.points))) return false;
  write(`upp:best:${mode}`, r);
  return true;
}
