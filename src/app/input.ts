// Pointer events -> Input[] per tick. The sim never sees DOM events, only these inputs.
import type { GameState, Input, WindowPart } from '../sim';
import { toVirtual } from './layout';

interface Drag {
  id: number;
  pointerId: number;
  /** pointer offset from the window's top-left at grab time, virtual px */
  grabX: number;
  grabY: number;
}

export class InputCapture {
  enabled = false;
  private pending: Input[] = [];
  private pointer: { x: number; y: number } | null = null;
  private sentPointer: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  private latest: GameState | null = null;

  constructor(private readonly desktop: HTMLElement) {
    desktop.addEventListener('pointermove', (e) => this.track(e));
    desktop.addEventListener('pointerdown', (e) => this.down(e));
    desktop.addEventListener('pointerup', (e) => this.up(e));
    desktop.addEventListener('pointercancel', (e) => this.up(e));
    desktop.addEventListener('click', (e) => this.click(e));
  }

  /** Clear everything between runs. */
  reset(): void {
    this.pending = [];
    this.drag = null;
    this.sentPointer = null;
  }

  /** Inputs for the next tick, built against the state that tick will read. */
  drain(state: GameState): Input[] {
    this.latest = state;
    if (!this.enabled) {
      this.pending = [];
      return [];
    }
    const out: Input[] = [];
    const p = this.pointer;
    if (p && (!this.sentPointer || p.x !== this.sentPointer.x || p.y !== this.sentPointer.y)) {
      out.push({ t: 'pointer', x: p.x, y: p.y });
      this.sentPointer = p;
    }
    out.push(...this.pending);
    this.pending = [];
    if (this.drag && p) {
      const w = state.windows.find((v) => v.id === this.drag!.id);
      if (!w) {
        this.drag = null;
      } else {
        // Aim for "window stays under the grab point"; the sim clamps it to the desktop.
        const dx = p.x - this.drag.grabX - w.x;
        const dy = p.y - this.drag.grabY - w.y;
        if (dx !== 0 || dy !== 0) out.push({ t: 'drag', id: w.id, dx, dy });
      }
    }
    return out;
  }

  private track(e: PointerEvent): void {
    this.pointer = toVirtual(e.clientX, e.clientY, this.desktop.getBoundingClientRect());
  }

  private down(e: PointerEvent): void {
    this.track(e);
    if (!this.enabled || e.button !== 0) return;
    const target = e.target as HTMLElement;
    const winEl = target.closest<HTMLElement>('.win[data-id]');
    if (!winEl || target.closest('[data-part]')) return;
    const id = Number(winEl.dataset.id);
    this.pending.push({ t: 'focus', id });
    const w = this.latest?.windows.find((v) => v.id === id);
    if (w && this.pointer && target.closest('.titlebar')) {
      this.drag = { id, pointerId: e.pointerId, grabX: this.pointer.x - w.x, grabY: this.pointer.y - w.y };
      this.desktop.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  private up(e: PointerEvent): void {
    this.track(e);
    if (this.drag && this.drag.pointerId === e.pointerId) this.drag = null;
  }

  private click(e: MouseEvent): void {
    if (!this.enabled) return;
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-part]');
    const winEl = target.closest<HTMLElement>('.win[data-id]');
    if (!btn || !winEl) return;
    this.pending.push({ t: 'click', id: Number(winEl.dataset.id), part: btn.dataset.part as WindowPart });
  }
}
