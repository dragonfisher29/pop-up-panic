// App-only visual effects: puff, combo popups, shake, hang vignette, cursor trail, force-quit ring.
// Reads GameState and FxEvents, never writes to sim state. All elements are pointer-events: none.
import { DESKTOP_H, DESKTOP_W, ramPercent, RUNNER_RADIUS, type GameState } from '../sim';
import type { FxEvent } from './events';
import { toVirtual } from './layout';

const TRAIL_DOTS = 7;
const TRAIL_LIFE_MS = 350;
const SHAKE_FROM_PCT = 80;
const SHAKE_STEP_MS = 50;
/** Minimum gap between force-quit rings: keeps flashes well under 3 per second. */
const RING_GAP_MS = 400;
const MAX_LIVE = 40;

export class Fx {
  private readonly layer: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly dots: HTMLElement[] = [];
  private readonly trail: { x: number; y: number; t: number }[] = [];
  private readonly mq: MediaQueryList | null;
  private reduced = false;
  private lastClose = { x: DESKTOP_W / 2, y: DESKTOP_H / 2 };
  private pointer = { x: DESKTOP_W / 2, y: DESKTOP_H / 2 };
  private lastRingAt = -Infinity;
  private shakeBucket = -1;
  private shaking = false;

  constructor(
    private readonly desktop: HTMLElement,
    private readonly windowsLayer: HTMLElement,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'fx-layer';
    this.vignette = document.createElement('div');
    this.vignette.className = 'fx-vignette';
    this.vignette.hidden = true;
    this.layer.appendChild(this.vignette);
    for (let i = 0; i < TRAIL_DOTS; i++) {
      const d = document.createElement('div');
      d.className = 'fx-dot';
      d.style.opacity = '0';
      this.layer.appendChild(d);
      this.dots.push(d);
    }
    desktop.appendChild(this.layer);

    this.mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reduced = this.mq?.matches ?? false;
    this.mq?.addEventListener('change', (e) => {
      this.reduced = e.matches;
      if (this.reduced) this.resetMotion();
    });
    this.layer.classList.toggle('reduced', this.reduced);

    desktop.addEventListener('pointermove', (e) => {
      const p = toVirtual(e.clientX, e.clientY, desktop.getBoundingClientRect());
      this.pointer = p;
      if (this.reduced) return;
      this.trail.push({ x: p.x, y: p.y, t: performance.now() });
      if (this.trail.length > TRAIL_DOTS * 2) this.trail.shift();
    });
  }

  /** Remove every transient overlay (call on startRun). */
  clear(): void {
    for (const el of Array.from(this.layer.children)) {
      if (el !== this.vignette && !this.dots.includes(el as HTMLElement)) el.remove();
    }
    this.trail.length = 0;
    this.vignette.hidden = true;
    this.resetMotion();
  }

  private resetMotion(): void {
    this.windowsLayer.style.transform = '';
    this.shaking = false;
    this.shakeBucket = -1;
    for (const d of this.dots) d.style.opacity = '0';
    this.trail.length = 0;
  }

  handle(events: readonly FxEvent[], nowMs: number): void {
    for (const e of events) {
      switch (e.t) {
        case 'close': {
          const cx = e.x + e.w / 2;
          const cy = e.y + e.h / 2;
          this.lastClose = { x: cx, y: cy };
          this.puff(cx, cy);
          break;
        }
        case 'combo':
          this.combo(e.n);
          break;
        case 'forceQuit':
          this.ring(nowMs);
          break;
        default:
          break;
      }
    }
  }

  /** Per-frame continuous effects while running. */
  frame(s: GameState, nowMs: number): void {
    const hanging = s.hangTicks > 0 && s.status === 'running';
    if (this.vignette.hidden === hanging) this.vignette.hidden = !hanging;

    const pct = ramPercent(s);
    if (!this.reduced && s.status === 'running' && pct >= SHAKE_FROM_PCT) {
      const amp = Math.min(3, 1 + Math.floor((pct - SHAKE_FROM_PCT) / 7));
      const bucket = Math.floor(nowMs / SHAKE_STEP_MS);
      if (bucket !== this.shakeBucket) {
        this.shakeBucket = bucket;
        const h = Math.imul(bucket ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
        const dx = (h % (2 * amp + 1)) - amp;
        const dy = ((h >>> 8) % (2 * amp + 1)) - amp;
        this.windowsLayer.style.transform = `translate(${dx}px, ${dy}px)`;
        this.shaking = true;
      }
    } else if (this.shaking) {
      this.windowsLayer.style.transform = '';
      this.shaking = false;
      this.shakeBucket = -1;
    }

    if (!this.reduced) {
      for (let i = 0; i < TRAIL_DOTS; i++) {
        const sample = this.trail[this.trail.length - 1 - i * 2];
        const dot = this.dots[i]!;
        if (!sample) {
          dot.style.opacity = '0';
          continue;
        }
        const age = nowMs - sample.t;
        const o = Math.max(0, 1 - age / TRAIL_LIFE_MS) * (1 - i / (TRAIL_DOTS + 1)) * 0.8;
        dot.style.opacity = o.toFixed(2);
        dot.style.transform = `translate(${sample.x - 3}px, ${sample.y - 3}px)`;
      }
    }
  }

  /** Touch: show the circle the runner dodges around the touch-down point (SPEC §11). */
  touchDown(x: number, y: number): void {
    const el = this.spawn('fx-dodge', x, y);
    el.style.setProperty('--r', `${RUNNER_RADIUS}px`);
  }

  private spawn(cls: string, x: number, y: number, text?: string): HTMLElement {
    // Cap live transient elements so a flood of closes can't pile up DOM.
    const live = this.layer.querySelectorAll('.fx-puff, .fx-combo, .fx-ring, .fx-dodge');
    if (live.length >= MAX_LIVE) live[0]!.remove();
    const el = document.createElement('div');
    el.className = cls;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    if (text) el.textContent = text;
    el.addEventListener('animationend', () => el.remove(), { once: true });
    this.layer.appendChild(el);
    return el;
  }

  private puff(x: number, y: number): void {
    const el = this.spawn('fx-puff', x, y);
    for (let i = 0; i < 6; i++) {
      const sq = document.createElement('i');
      const a = (i / 6) * Math.PI * 2 + 0.4;
      sq.style.setProperty('--dx', `${Math.round(Math.cos(a) * 26)}px`);
      sq.style.setProperty('--dy', `${Math.round(Math.sin(a) * 20)}px`);
      if (i % 2) sq.className = 'g';
      el.appendChild(sq);
    }
  }

  private combo(n: number): void {
    const x = Math.min(DESKTOP_W - 60, Math.max(60, this.lastClose.x));
    const y = Math.min(DESKTOP_H - 80, Math.max(40, this.lastClose.y - 30));
    this.spawn('fx-combo', x, y, `×${n}!`);
  }

  private ring(nowMs: number): void {
    if (nowMs - this.lastRingAt < RING_GAP_MS) return;
    this.lastRingAt = nowMs;
    this.spawn('fx-ring', this.pointer.x, this.pointer.y);
  }
}
