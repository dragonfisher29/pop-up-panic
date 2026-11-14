// Leaderboard client: initials picker state, input-log encoding and the /api calls (ARCHITECTURE §6).
import type { Input } from '../sim';
import { isValidInitials } from './blocklist';

const A = 'A'.charCodeAt(0);

export interface Picker {
  letters: [string, string, string];
  cursor: 0 | 1 | 2;
}

export function newPicker(saved: string | null): Picker {
  const s = saved && /^[A-Z]{3}$/.test(saved) ? saved : 'AAA';
  return { letters: [s[0]!, s[1]!, s[2]!], cursor: 0 };
}

function roll(letter: string, dir: 1 | -1): string {
  return String.fromCharCode(A + ((letter.charCodeAt(0) - A + dir + 26) % 26));
}

export function pickerTap(p: Picker, wheel: 0 | 1 | 2, dir: 1 | -1): Picker {
  const letters = [...p.letters] as Picker['letters'];
  letters[wheel] = roll(letters[wheel], dir);
  return { letters, cursor: wheel };
}

export interface PickerResult {
  picker: Picker;
  /** Initials to submit, when Enter was pressed on a valid set. */
  submit: string | null;
  /** Enter was pressed on a blocked word. */
  blocked: boolean;
}

const clampCursor = (n: number): Picker['cursor'] => Math.max(0, Math.min(2, n)) as Picker['cursor'];

export function pickerKey(p: Picker, key: string): PickerResult {
  const out = (picker: Picker, submit: string | null = null, blocked = false): PickerResult => ({ picker, submit, blocked });
  if (key === 'ArrowUp') return out(pickerTap(p, p.cursor, -1));
  if (key === 'ArrowDown') return out(pickerTap(p, p.cursor, 1));
  if (key === 'ArrowLeft' || key === 'Backspace') return out({ ...p, cursor: clampCursor(p.cursor - 1) });
  if (key === 'ArrowRight') return out({ ...p, cursor: clampCursor(p.cursor + 1) });
  if (key === 'Enter') {
    const s = p.letters.join('');
    return isValidInitials(s) ? out(p, s) : out(p, null, true);
  }
  if (/^[a-z]$/i.test(key)) {
    const letters = [...p.letters] as Picker['letters'];
    letters[p.cursor] = key.toUpperCase();
    return out({ letters, cursor: clampCursor(p.cursor + 1) });
  }
  return out(p);
}

export type LogEntry = (number | string)[];

/** One input as `[tick, type, ...fields]` (ARCHITECTURE §4). Field order is fixed per type for the M5b replay. */
export function encodeInput(tick: number, i: Input): LogEntry {
  switch (i.t) {
    case 'pointer':
    case 'forceQuit':
      return [tick, i.t, i.x, i.y];
    case 'click':
      return [tick, i.t, i.id, i.part];
    case 'focus':
      return [tick, i.t, i.id];
    case 'drag':
      return [tick, i.t, i.id, i.dx, i.dy];
    case 'taskManager':
      return [tick, i.t];
  }
}

export interface Submission {
  day: string;
  initials: string;
  timeMs: number;
  points: number;
  closes: number;
  inputLog: LogEntry[];
}

export type SubmitResult = { ok: true; rank: number } | { ok: false; reason: 'rate' | 'rejected' | 'offline' };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: Fetch = (u, i) => fetch(u, i);

export async function submitScore(s: Submission, f: Fetch = defaultFetch): Promise<SubmitResult> {
  try {
    const res = await f('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(s),
    });
    if (res.status === 429) return { ok: false, reason: 'rate' };
    if (!res.ok) return { ok: false, reason: 'rejected' };
    const body = (await res.json()) as { rank?: unknown };
    return typeof body.rank === 'number' ? { ok: true, rank: body.rank } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export interface BoardRow {
  rank: number;
  initials: string;
  timeMs: number;
  points: number;
}

export interface Board {
  top: BoardRow[];
  me: BoardRow | null;
}

export async function fetchBoard(day: string, me: string | null, f: Fetch = defaultFetch): Promise<Board | null> {
  try {
    const q = `day=${encodeURIComponent(day)}${me ? `&me=${encodeURIComponent(me)}` : ''}`;
    const res = await f(`/api/scores?${q}`);
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<Board>;
    return Array.isArray(body.top) ? { top: body.top, me: body.me ?? null } : null;
  } catch {
    return null;
  }
}
