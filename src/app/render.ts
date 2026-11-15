// Keyed DOM renderer: windows and strips by id, plus the taskbar HUD. Reads state, never writes to it.
import {
  FANFARE_TICKS,
  FORCE_QUIT_MAX,
  HANG_FUSE_TICKS,
  latestUnlock,
  ramPercent,
  STRIP_H,
  survivalMs,
  TELL_TICKS,
  TICK_HZ,
  type GameState,
  type Win,
} from '../sim';
import { KIND_LABEL, pickCopy, STRIP_NAMES, SYSTEM } from './copy';
import { formatClock } from './layout';

const X_ICON =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="2" shape-rendering="crispEdges"/></svg>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const btn = (part: string, label: string, cls = 'btn') =>
  `<button class="${cls}" type="button" data-part="${part}">${escapeHtml(label)}</button>`;

/** Whole seconds left on a prize countdown, for display. */
function secondsLeft(s: GameState, w: Win): number {
  return Math.max(0, Math.ceil((w.timerTick - s.tick) / TICK_HZ));
}

function isTelling(s: GameState, w: Win): boolean {
  return w.tellUntilTick > 0 && s.tick >= w.tellUntilTick - TELL_TICKS && s.tick < w.tellUntilTick;
}

export interface HudEls {
  layer: HTMLElement;
  strips: HTMLElement;
  ramFill: HTMLElement;
  ramLabel: HTMLElement;
  clock: HTMLElement;
  hang: HTMLElement;
  notice: HTMLElement;
  forceQuit: HTMLElement;
  taskManager: HTMLElement;
}

export class Renderer {
  private nodes = new Map<number, HTMLElement>();
  private stripNodes = new Map<number, HTMLElement>();
  private lastTopId = -1;

  constructor(private readonly els: HudEls) {}

  clear(): void {
    for (const el of this.nodes.values()) el.remove();
    for (const el of this.stripNodes.values()) el.remove();
    this.nodes.clear();
    this.stripNodes.clear();
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
        el = this.createWindow(s, w);
        this.els.layer.appendChild(el);
        this.nodes.set(w.id, el);
      }
      const left = `${w.x}px`;
      const topPx = `${w.y}px`;
      if (el.style.left !== left) el.style.left = left;
      if (el.style.top !== topPx) el.style.top = topPx;
      const z = String(w.z);
      if (el.style.zIndex !== z) el.style.zIndex = z;
      el.classList.toggle('tell', isTelling(s, w));
      if (w.kind === 'runner') el.classList.toggle('tired', w.stage === 2);
      if (w.kind === 'prize') {
        const t = el.querySelector<HTMLElement>('.count');
        const left = String(secondsLeft(s, w));
        if (t && t.textContent !== left) t.textContent = left;
      }
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
    this.renderStrips(s);
    this.renderHud(s);
  }

  private createWindow(s: GameState, w: Win): HTMLElement {
    const copy = pickCopy(s.seed, w.id, w.kind, w.stage, w.stageCount);
    const el = document.createElement('div');
    el.className = `win kind-${w.kind} pop-in`;
    el.addEventListener('animationend', (e) => {
      if (e.animationName === 'pop-in' || e.animationName === 'pop-in-fade') el.classList.remove('pop-in');
    });
    el.dataset.id = String(w.id);
    el.style.width = `${w.w}px`;
    el.style.height = `${w.h}px`;
    const title = escapeHtml(copy.title);
    let text = escapeHtml(copy.body);
    let actions = '';
    let badge = '!';
    switch (w.kind) {
      case 'fakeX':
        actions = btn('link', copy.link ?? 'no thanks', 'link');
        break;
      case 'prize':
        text = text.replace('{t}', `<b class="count">${secondsLeft(s, w)}</b>`);
        actions = btn('body', 'CLAIM', 'btn claim');
        badge = '$';
        break;
      case 'virusScan':
        actions = btn('cancel', 'Cancel scan');
        badge = '☣';
        break;
      case 'confirm': {
        const last = w.stageCount > 0 && w.stage === w.stageCount - 1;
        actions = btn('body', last ? 'Yes, close all' : 'Yes') + btn('cancel', 'No');
        badge = '?';
        break;
      }
      case 'toolbar':
        actions = btn('body', 'Install');
        badge = '🔍';
        break;
      case 'antivirus':
        badge = '♥';
        break;
      case 'runner':
        badge = '»';
        break;
    }
    el.innerHTML =
      `<div class="titlebar"><span class="title">${title}</span>` +
      `<button class="x" type="button" data-part="close" aria-label="Close ${title}">${X_ICON}</button></div>` +
      `<div class="body"><span class="badge" aria-hidden="true">${badge}</span><div class="text"><p>${text}</p>` +
      (actions ? `<div class="actions">${actions}</div>` : '') +
      `</div></div>`;
    return el;
  }

  private renderStrips(s: GameState): void {
    const seen = new Set<number>();
    s.strips.forEach((st, i) => {
      seen.add(st.id);
      let el = this.stripNodes.get(st.id);
      if (!el) {
        const name = STRIP_NAMES[st.name % STRIP_NAMES.length]!;
        el = document.createElement('div');
        el.className = 'strip';
        el.dataset.id = String(st.id);
        el.innerHTML =
          `<span class="strip-name">${escapeHtml(name)}</span><input class="strip-search" tabindex="-1" disabled value="Search the web… and more!">` +
          `<button class="tray-icon" type="button" data-part="tray" title="${escapeHtml(SYSTEM.uninstall(name))}" aria-label="${escapeHtml(SYSTEM.uninstall(name))}">✕</button>`;
        this.els.strips.appendChild(el);
        this.stripNodes.set(st.id, el);
      }
      const top = `${i * STRIP_H}px`;
      if (el.style.top !== top) el.style.top = top;
    });
    for (const [id, el] of this.stripNodes) {
      if (!seen.has(id)) {
        el.remove();
        this.stripNodes.delete(id);
      }
    }
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

    // Notices: Task Manager flash > antivirus penalty > new-wave fanfare.
    const unlock = latestUnlock(s.tick);
    let notice = '';
    let cls = '';
    if (s.tick < s.flashUntilTick) {
      notice = SYSTEM.endTask(s.flashCount);
      cls = 'flash';
    } else if (s.tick < s.spikeUntilTick) {
      notice = SYSTEM.antivirusClosed;
      cls = 'penalty';
    } else if (unlock.tick > 0 && s.tick - unlock.tick < FANFARE_TICKS) {
      notice = SYSTEM.newThreat(KIND_LABEL[unlock.kind]);
      cls = 'fanfare';
    }
    this.els.notice.hidden = notice === '';
    if (this.els.notice.textContent !== notice) this.els.notice.textContent = notice;
    if (this.els.notice.dataset.kind !== cls) this.els.notice.dataset.kind = cls;

    const fq = `×${s.forceQuits}`;
    const fqCount = this.els.forceQuit.querySelector('.tool-count')!;
    if (fqCount.textContent !== fq) fqCount.textContent = fq;
    this.els.forceQuit.classList.toggle('empty', s.forceQuits === 0);
    this.els.forceQuit.title = SYSTEM.forceQuitHint(s.forceQuits, FORCE_QUIT_MAX);
    this.els.taskManager.classList.toggle('empty', s.taskManagerUsed);
  }
}
