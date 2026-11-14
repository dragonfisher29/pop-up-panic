// localStorage wrapper. Every access is in try/catch: private windows and blocked storage must not break the game.

export interface Settings {
  mute: boolean;
}

const SETTINGS_KEY = 'upp:settings';
const DEFAULTS: Settings = { mute: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { mute: parsed.mute === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    const prev = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, ...s }));
  } catch {
    // storage unavailable: settings last for this visit only
  }
}
