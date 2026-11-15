// localStorage wrapper. Every access is in try/catch: private windows and blocked storage must not break the game.
// Keys (ARCHITECTURE §7): upp:settings · upp:best · upp:initials · upp:pending
// Legacy (read-only, from the old Daily/Endless modes): upp:best:endless · upp:best:daily

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

const better = (a: RunResult, b: RunResult): boolean => a.timeMs > b.timeMs || (a.timeMs === b.timeMs && a.points > b.points);

/** The local best run. Falls back to the better of the old Daily / Endless bests. */
export function loadBest(): RunResult | null {
  const cur = asRun(read('upp:best'));
  if (cur) return cur;
  const legacy = [asRun(read('upp:best:endless')), asRun(read('upp:best:daily'))].filter((r): r is RunResult => r !== null);
  return legacy.reduce<RunResult | null>((a, r) => (a && !better(r, a) ? a : r), null);
}

export function loadInitials(): string | null {
  const v = read('upp:initials');
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : null;
}

export function saveInitials(s: string): void {
  write('upp:initials', s);
}

/** The last run waiting to be sent (set at crash, cleared once sent). A newer run replaces it. */
export interface PendingRun {
  timeMs: number;
  points: number;
  closes: number;
  inputLog: (number | string)[][];
}

const PENDING_KEY = 'upp:pending';

export function loadPending(): PendingRun | null {
  const v = read(PENDING_KEY) as PendingRun | null;
  return v && typeof v === 'object' && Array.isArray(v.inputLog) && v.inputLog.length > 0 && isCount(v.timeMs) ? v : null;
}

export function savePending(r: PendingRun): void {
  write(PENDING_KEY, r);
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable
  }
}

/** Keeps the longer run (points break ties). Returns true if `r` is a new best. */
export function saveBest(r: RunResult): boolean {
  const prev = loadBest();
  if (prev && !better(r, prev)) return false;
  write('upp:best', r);
  return true;
}
