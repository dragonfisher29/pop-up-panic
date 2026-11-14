// M0 starter app: a bare-bones renderer and loop so you can see the sim working.
// M1 replaces this with render.ts / input.ts, real window chrome, scaling, title screen and more.
import './styles.css';
import {
  createGame,
  DESKTOP_H,
  DESKTOP_W,
  MS_PER_TICK,
  ramPercent,
  step,
  survivalMs,
  type GameState,
  type Input,
} from '../sim';

const MAX_STEPS_PER_FRAME = 5;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="stage">
    <div class="desktop" style="width:${DESKTOP_W}px;height:${DESKTOP_H}px">
      <div class="windows"></div>
      <div class="taskbar">
        <button class="begin" type="button">Begin</button>
        <div class="ram"><div class="ram-fill"></div><span class="ram-label">RAM 10%</span></div>
        <span class="clock">0:00</span>
      </div>
      <div class="crash" hidden>
        <p>A fatal exception 0xPANIC has occurred.</p>
        <p class="crash-result"></p>
        <button class="retry" type="button">Retry</button>
      </div>
    </div>
  </div>`;

const desktop = app.querySelector<HTMLDivElement>('.desktop')!;
const layer = app.querySelector<HTMLDivElement>('.windows')!;
const ramFill = app.querySelector<HTMLDivElement>('.ram-fill')!;
const ramLabel = app.querySelector<HTMLSpanElement>('.ram-label')!;
const clock = app.querySelector<HTMLSpanElement>('.clock')!;
const crash = app.querySelector<HTMLDivElement>('.crash')!;
const crashResult = app.querySelector<HTMLParagraphElement>('.crash-result')!;

let state: GameState = createGame((Math.random() * 2 ** 32) >>> 0);
let pending: Input[] = [];
const nodes = new Map<number, HTMLDivElement>();

layer.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-close]');
  if (btn) pending.push({ t: 'close', id: Number(btn.dataset.close) });
});
app.querySelector('.retry')!.addEventListener('click', () => {
  state = createGame((Math.random() * 2 ** 32) >>> 0);
  crash.hidden = true;
});

function fit(): void {
  const s = Math.min(window.innerWidth / DESKTOP_W, window.innerHeight / DESKTOP_H);
  desktop.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

function fmt(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function render(s: GameState): void {
  const seen = new Set<number>();
  for (const w of s.windows) {
    seen.add(w.id);
    let el = nodes.get(w.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'win';
      el.innerHTML = `<div class="title"><span>DOWNLOAD MORE RAM</span><button type="button" data-close="${w.id}" aria-label="Close">×</button></div><div class="body">100% legal. 0% possible.</div>`;
      el.style.width = `${w.w}px`;
      el.style.height = `${w.h}px`;
      layer.appendChild(el);
      nodes.set(w.id, el);
    }
    el.style.left = `${w.x}px`;
    el.style.top = `${w.y}px`;
    el.style.zIndex = String(w.z);
  }
  for (const [id, el] of nodes) {
    if (!seen.has(id)) {
      el.remove();
      nodes.delete(id);
    }
  }
  const pct = ramPercent(s);
  ramFill.style.width = `${Math.min(pct, 100)}%`;
  ramFill.classList.toggle('hot', pct >= 80);
  ramLabel.textContent = s.hangTicks > 0 ? 'NOT RESPONDING' : `RAM ${pct}%`;
  clock.textContent = fmt(survivalMs(s));
  if (s.status === 'crashed' && crash.hidden) {
    crashResult.textContent = `You survived ${fmt(survivalMs(s))} · ${s.closes} closes · ${s.points} pts`;
    crash.hidden = false;
  }
}

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += now - last;
  last = now;
  let steps = 0;
  while (acc >= MS_PER_TICK && steps < MAX_STEPS_PER_FRAME) {
    state = step(state, pending);
    pending = [];
    acc -= MS_PER_TICK;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) acc = 0;
  render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
