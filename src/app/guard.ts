// Error guard: any uncaught error shows a joke "Blue Screen of Panic" with a Reboot button
// instead of a frozen page. Lives outside the scaled desktop so it reads at any size.
import { SYSTEM } from './copy';

export interface Guard {
  /** true once an error has been shown; the game loop stops on it */
  readonly tripped: boolean;
  /** Report an error. Only the first one is shown. */
  trip(err: unknown): void;
}

/** Short, single-line description of an error for the screen's small print. */
export function describeError(err: unknown): string {
  let s: string;
  if (err instanceof Error) s = `${err.name}: ${err.message}`;
  else if (typeof err === 'string') s = err;
  else {
    try {
      s = JSON.stringify(err) ?? String(err);
    } catch {
      s = String(err);
    }
  }
  s = s.replace(/\s+/g, ' ').trim() || 'Unknown error';
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

/** Latch around a `show` callback: it runs once, for the first error only. */
export function createGuard(show: (detail: string) => void): Guard {
  let tripped = false;
  return {
    get tripped() {
      return tripped;
    },
    trip(err: unknown) {
      if (tripped) return;
      tripped = true;
      try {
        console.error(err);
        show(describeError(err));
      } catch {
        // The guard itself must never throw.
      }
    },
  };
}

function showBsod(detail: string): void {
  const el = document.createElement('div');
  el.className = 'bsod';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-labelledby', 'bsod-title');
  el.innerHTML = `
    <div class="bsod-box">
      <p class="bsod-title" id="bsod-title">${SYSTEM.bsodTitle}</p>
      <p>${SYSTEM.bsodBody}</p>
      <p class="bsod-detail"></p>
      <button class="bsod-reboot" type="button">${SYSTEM.bsodReboot}</button>
    </div>`;
  el.querySelector('.bsod-detail')!.textContent = detail;
  el.querySelector('.bsod-reboot')!.addEventListener('click', () => location.reload());
  document.body.appendChild(el);
  el.querySelector<HTMLButtonElement>('.bsod-reboot')!.focus();
}

export const guard = createGuard(showBsod);

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => guard.trip(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => guard.trip(e.reason));
}
