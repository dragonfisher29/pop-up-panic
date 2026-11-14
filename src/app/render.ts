// Keyed DOM renderer: windows by id plus the taskbar HUD. Reads state, never writes to it.
import { HANG_FUSE_TICKS, ramPercent, survivalMs, TICK_HZ, type GameState, type Win } from '../sim';
import { pickCopy, SYSTEM } from './copy';
import { formatClock } from './layout';

const X_ICON =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="2" shape-rendering="crispEdges"/></svg>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export interface HudEls {
  layer: HTMLElement;
  ramFill: HTMLElement;
  ramLabel: HTMLElement;
  clock: HTMLElement;
  hang: HTMLElement;
}

export class Renderer {
  private nodes = new Map<number, HTMLElement>();
  private lastTopId = -1;

  constructor(private readonly els: HudEls) {}

  clear(): void {
    for (const el of this.nodes.values()) el.remove();
    this.nodes.clear();
    this.lastTopId = -1;
  }

  render(s: GameState): void {
    const seen = new Set<number>();
    let top: Win | null = null;
    for (const w of s.windows) {
      seen.add(w.id);
      if (!top || w.z > top.z) top = w;
      let el = this.nodes.get(w.id);
      if (!el) {
        el = this.createWindow(s.seed, w);
        this.els.layer.appendChild(el);
        this.nodes.set(w.id, el);
      }
      const left = `${w.x}px`;
      const topPx = `${w.y}px`;
      if (el.style.left !== left) el.style.left = left;
      if (el.style.top !== topPx) el.style.top = topPx;
      const z = String(w.z);
      if (el.style.zIndex !== z) el.style.zIndex = z;
    }
    for (const [id, el] of this.nodes) {
      if (!seen.has(id)) {
        el.remove();
        this.nodes.delete(id);
      }
    }
    const topId = top?.id ?? -1;
    if (topId !== this.lastTopId) {
      this.nodes.get(this.lastTopId)?.classList.remove('active');
      this.nodes.get(topId)?.classList.add('active');
      this.lastTopId = topId;
    }
    this.renderHud(s);
  }

  private createWindow(seed: number, w: Win): HTMLElement {
    const copy = pickCopy(seed, w.id, w.kind);
    const el = document.createElement('div');
    el.className = `win kind-${w.kind}`;
    el.dataset.id = String(w.id);
    el.style.width = `${w.w}px`;
    el.style.height = `${w.h}px`;
    el.innerHTML =
      `<div class="titlebar"><span class="title">${escapeHtml(copy.title)}</span>` +
      `<button class="x" type="button" data-part="close" aria-label="Close ${escapeHtml(copy.title)}">${X_ICON}</button></div>` +
      `<div class="body"><span class="badge" aria-hidden="true">!</span><p>${escapeHtml(copy.body)}</p></div>`;
    return el;
  }

  private renderHud(s: GameState): void {
    const pct = ramPercent(s);
    this.els.ramFill.style.width = `${Math.min(pct, 100)}%`;
    this.els.ramFill.classList.toggle('hot', pct >= 80);
    this.els.ramLabel.textContent = `RAM ${pct}%`;
    this.els.clock.textContent = formatClock(survivalMs(s));
    const hanging = s.hangTicks > 0 && s.status === 'running';
    this.els.hang.hidden = !hanging;
    if (hanging) {
      const left = Math.ceil((HANG_FUSE_TICKS - s.hangTicks) / TICK_HZ);
      this.els.hang.textContent = SYSTEM.hang(left);
    }
  }
}
