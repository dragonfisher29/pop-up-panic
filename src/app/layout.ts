// Pure layout helpers: fit the 1280x720 desktop into the viewport and map pointer coords back.
import { DESKTOP_H, DESKTOP_W } from '../sim';

export interface Fit {
  scale: number;
  /** left/top offset in CSS px of the scaled desktop inside the viewport (letterbox bars) */
  left: number;
  top: number;
}

/** Largest scale that fits the viewport, centred, with letterbox or pillarbox bars. */
export function fitDesktop(viewW: number, viewH: number): Fit {
  const scale = Math.max(0.1, Math.min(viewW / DESKTOP_W, viewH / DESKTOP_H));
  return {
    scale,
    left: Math.round((viewW - DESKTOP_W * scale) / 2),
    top: Math.round((viewH - DESKTOP_H * scale) / 2),
  };
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Client (CSS px) -> virtual desktop px, as integers, using the desktop's on-screen rect. */
export function toVirtual(clientX: number, clientY: number, rect: RectLike): { x: number; y: number } {
  return {
    x: Math.floor(((clientX - rect.left) * DESKTOP_W) / rect.width),
    y: Math.floor(((clientY - rect.top) * DESKTOP_H) / rect.height),
  };
}

/** m:ss for the run clock and results. */
export function formatClock(ms: number): string {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
