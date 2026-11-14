// Boot, screens (title → boot crawl → run → crash → results) and the fixed-timestep loop.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles.css';
import { createGame, DESKTOP_H, DESKTOP_W, MS_PER_TICK, ramPercent, step, survivalMs, type GameState } from '../sim';
import { Sfx } from './audio';
import { SYSTEM } from './copy';
import { fxEvents, type FxEvent } from './events';
import { InputCapture } from './input';
import { Fx } from './fx';
import { countUp, fitDesktop, formatClock } from './layout';
import { Renderer } from './render';
import { dailySeed, dayKey, formatCountdown, msUntilNextDay, puzzleNumber } from './daily';
import { ramStrip, shareText } from './share';
import {
  loadBest,
  loadDaily,
  loadSettings,
  saveBest,
  saveDailyIfFirst,
  saveSettings,
  type DailyResult,
  type RunResult,
} from './storage';

type Mode = 'daily' | 'endless';
const TOAST_MS = 1600;

const MAX_STEPS_PER_FRAME = 5;
const BOOT_LINE_MS = 450;
const BOOT_HOLD_MS = 700;
/** The crash screen ignores input for this long so a panicked click doesn't skip it. */
const CRASH_LOCK_MS = 900;

type Phase = 'title' | 'boot' | 'run' | 'crash' | 'results';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="desktop" style="width:${DESKTOP_W}px;height:${DESKTOP_H}px">
    <div class="strips"></div>
    <div class="windows"></div>
    <div class="hang" role="status" hidden></div>
    <div class="notice" role="status" hidden></div>
    <div class="dialog about" role="dialog" aria-labelledby="about-title" hidden>
      <div class="titlebar"><span class="title" id="about-title">${SYSTEM.aboutTitle}</span></div>
      <div class="body"><p>${SYSTEM.aboutBody}</p><button class="btn about-ok" type="button">${SYSTEM.aboutOk}</button></div>
    </div>
    <div class="menu" role="menu" hidden>
      <div class="menu-side" aria-hidden="true">PanicOS<b>97</b></div>
      <div class="menu-items">
        <button class="menu-item" type="button" role="menuitemcheckbox" data-menu="mute" aria-checked="false"><span class="check" aria-hidden="true"></span>${SYSTEM.menuMute}</button>
        <button class="menu-item" type="button" role="menuitem" data-menu="about"><span class="check" aria-hidden="true"></span>${SYSTEM.menuAbout}</button>
      </div>
    </div>
    <div class="taskbar">
      <button class="begin" type="button" aria-haspopup="menu" aria-expanded="false"><span class="begin-logo" aria-hidden="true"></span>Begin</button>
      <div class="ram" role="meter" aria-label="RAM used" aria-valuemin="0" aria-valuemax="100">
        <div class="ram-fill"></div><span class="ram-label">RAM 10%</span>
      </div>
      <div class="tools">
        <span class="tool tool-fq"><kbd>ALT+F4</kbd><span class="tool-count">×3</span></span>
        <span class="tool tool-tm" title="${SYSTEM.taskManagerHint}"><kbd>CTRL+ALT+DEL</kbd></span>
      </div>
      <div class="tray"><span class="clock">0:00</span></div>
    </div>
    <div class="screen title-screen">
      <p class="title-logo">PanicOS <b>97</b></p>
      <div class="modes" role="group" aria-label="Mode">
        <button class="mode mode-daily" type="button" data-mode="daily"><b class="mode-name"></b><span class="mode-sub"></span></button>
        <button class="mode mode-endless" type="button" data-mode="endless"><b class="mode-name">${SYSTEM.modeEndless}</b><span class="mode-sub"></span></button>
      </div>
      <p class="blink">${SYSTEM.titlePrompt}</p>
      <p class="hint">${SYSTEM.titleKeys}</p>
    </div>
    <div class="screen boot-screen" hidden>
      <pre class="boot-log"></pre>
      <p class="hint">${SYSTEM.bootSkip}</p>
    </div>
    <div class="screen crash-screen" hidden>
      <p class="crash-title">${SYSTEM.crashTitle}</p>
      <p>${SYSTEM.crashBody}</p>
      <p class="crash-prompt">${SYSTEM.crashPrompt}</p>
    </div>
    <div class="results-backdrop" hidden>
      <div class="dialog results" role="dialog" aria-labelledby="results-title">
        <div class="titlebar"><span class="title" id="results-title">${SYSTEM.resultsTitle}</span></div>
        <div class="body">
          <p class="results-mode"></p>
          <p class="results-time"></p>
          <p class="results-best" hidden>${SYSTEM.newBest}</p>
          <ul class="results-stats"><li class="results-closes"></li><li class="results-points"></li><li class="results-combo"></li></ul>
          <p class="results-strip" aria-label="RAM over the run"></p>
          <p class="results-next" hidden></p>
          <div class="results-copy" hidden><p>${SYSTEM.copyFailed}</p><textarea readonly rows="2"></textarea></div>
          <div class="results-actions">
            <button class="btn share" type="button">${SYSTEM.share}</button>
            <button class="btn retry" type="button">${SYSTEM.retry}</button>
            <button class="btn to-menu" type="button">${SYSTEM.menu}</button>
          </div>
          <p class="toast" role="status" hidden>${SYSTEM.copied}</p>
        </div>
      </div>
    </div>
  </div>`;

const $ = <T extends HTMLElement>(sel: string): T => app.querySelector<T>(sel)!;
const desktop = $('.desktop');
const titleScreen = $('.title-screen');
const bootScreen = $('.boot-screen');
const bootLog = $('.boot-log');
const crashScreen = $('.crash-screen');
const results = $('.results-backdrop');
const menu = $('.menu');
const beginBtn = $<HTMLButtonElement>('.begin');
const muteItem = $('[data-menu="mute"]');
const about = $('.about');

const renderer = new Renderer({
  layer: $('.windows'),
  strips: $('.strips'),
  ramFill: $('.ram-fill'),
  ramLabel: $('.ram-label'),
  clock: $('.clock'),
  hang: $('.hang'),
  notice: $('.notice'),
  forceQuit: $('.tool-fq'),
  taskManager: $('.tool-tm'),
});
const fx = new Fx(desktop, $('.windows'));
const input = new InputCapture(desktop);
const settings = loadSettings();

let phase: Phase = 'title';
let state: GameState = createGame(newSeed());
let prevState: GameState = state;
const sfx = new Sfx();
sfx.setMuted(settings.mute);
// Browsers block audio until a gesture: unlock on the first pointerdown/keydown.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, () => sfx.unlock(), { capture: true });
let crashAt = 0;
let bootTimers: number[] = [];

// ---------- mode and run record ----------
let mode: Mode = 'daily';
/** UTC day the current daily run was started on (a run that crosses midnight stays on its day). */
let runDay = dayKey(new Date());
/** RAM (milli-percent) after every tick of the current run, for the share strip. */
let ramSamples: number[] = [];
let lastRun: RunResult | null = null;
/** The day's ranked result when the last run was practice; null when the last run was ranked or Endless. */
let rankedRun: DailyResult | null = null;
let isNewBest = false;

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

function seedFor(m: Mode): number {
  return m === 'daily' ? dailySeed(runDay) : newSeed();
}

function paintTitle(): void {
  const day = dayKey(new Date());
  const ranked = loadDaily(day);
  $('.mode-daily .mode-name').textContent = SYSTEM.modeDaily(puzzleNumber(day));
  $('.mode-daily .mode-sub').textContent = ranked
    ? SYSTEM.modeDailyPractice(formatClock(ranked.timeMs))
    : SYSTEM.modeDailyRanked;
  const best = loadBest('endless');
  $('.mode-endless .mode-sub').textContent = best ? SYSTEM.modeEndlessBest(formatClock(best.timeMs)) : SYSTEM.modeEndlessNew;
}

function showTitle(): void {
  phase = 'title';
  show(results, false);
  show(crashScreen, false);
  paintTitle();
  show(titleScreen, true);
  $<HTMLButtonElement>(`.mode-${mode}`).focus();
}

function pickMode(m: Mode): void {
  mode = m;
  boot();
}

/** Saves the finished run: the day's ranked result (first daily run only) and the per-mode best. */
function recordRun(): void {
  const run: RunResult = {
    timeMs: survivalMs(state),
    points: state.points,
    closes: state.closes,
    bestCombo: state.bestCombo,
    strip: ramStrip(ramSamples, state.status === 'crashed'),
  };
  lastRun = run;
  rankedRun = null;
  if (mode === 'daily') {
    const daily: DailyResult = { ...run, day: runDay };
    if (!saveDailyIfFirst(daily)) rankedRun = loadDaily(runDay);
  }
  isNewBest = saveBest(mode, run);
}

// ---------- layout ----------
function fit(): void {
  const f = fitDesktop(window.innerWidth, window.innerHeight);
  desktop.style.left = `${f.left}px`;
  desktop.style.top = `${f.top}px`;
  desktop.style.transform = `scale(${f.scale})`;
}
window.addEventListener('resize', fit);
fit();

// ---------- phases ----------
function show(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

function boot(): void {
  phase = 'boot';
  show(titleScreen, false);
  show(bootScreen, true);
  bootLog.textContent = '';
  SYSTEM.boot.forEach((line, i) => {
    bootTimers.push(window.setTimeout(() => (bootLog.textContent += `${line}\n`), BOOT_LINE_MS * (i + 1)));
  });
  bootTimers.push(window.setTimeout(startRun, BOOT_LINE_MS * (SYSTEM.boot.length + 1) + BOOT_HOLD_MS));
}

function startRun(): void {
  for (const t of bootTimers) clearTimeout(t);
  bootTimers = [];
  phase = 'run';
  show(bootScreen, false);
  show(crashScreen, false);
  show(results, false);
  closeMenu();
  renderer.clear();
  fx.clear();
  if (mode === 'daily') runDay = dayKey(new Date());
  state = createGame(seedFor(mode));
  prevState = state;
  ramSamples = [];
  hideShareUi();
  input.reset();
  input.enabled = true;
  acc = 0;
  last = performance.now();
}

function enterCrash(): void {
  phase = 'crash';
  input.enabled = false;
  closeMenu();
  crashAt = performance.now();
  recordRun();
  show(crashScreen, true);
}

function showResults(): void {
  if (performance.now() - crashAt < CRASH_LOCK_MS) return;
  phase = 'results';
  show(crashScreen, false);
  countStart = performance.now();
  paintResultsOnce();
  paintResults(countStart);
  show(results, true);
  $<HTMLButtonElement>('.retry').focus();
}

function onAnyKey(): void {
  if (phase === 'title') pickMode(mode);
  else if (phase === 'boot') startRun();
  else if (phase === 'crash') showResults();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape') closeMenu();
  if (phase === 'results') {
    // Enter/Space activate the focused button (Retry by default); Escape goes back to the title.
    if (e.key === 'Escape') showTitle();
    return;
  }
  if (phase === 'title') {
    const k = e.key.toLowerCase();
    if (k === 'd' || k === 'e') return pickMode(k === 'd' ? 'daily' : 'endless');
    if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown' || k === 'tab') {
      e.preventDefault();
      mode = mode === 'daily' ? 'endless' : 'daily';
      $<HTMLButtonElement>(`.mode-${mode}`).focus();
      return;
    }
    if (['shift', 'control', 'alt', 'meta'].includes(k)) return;
  }
  // Enter/Space would also "click" whatever gets focus next (Retry on the results panel).
  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
  if (phase === 'run') {
    if (input.key(e)) e.preventDefault();
    return;
  }
  onAnyKey();
});
window.addEventListener('keyup', (e) => {
  if (phase === 'run' && e.key === ' ') e.preventDefault(); // no button activation on Space release
});
for (const el of [bootScreen, crashScreen]) el.addEventListener('pointerdown', onAnyKey);
for (const btn of titleScreen.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  btn.addEventListener('click', () => pickMode(btn.dataset.mode as Mode));
  btn.addEventListener('focus', () => (mode = btn.dataset.mode as Mode));
}
$('.retry').addEventListener('click', startRun);
$('.to-menu').addEventListener('click', showTitle);
$('.share').addEventListener('click', () => void share());
paintTitle();
$<HTMLButtonElement>('.mode-daily').focus();

// ---------- Begin menu ----------
function closeMenu(): void {
  show(menu, false);
  beginBtn.setAttribute('aria-expanded', 'false');
  beginBtn.classList.remove('pressed');
}
function syncMute(): void {
  muteItem.setAttribute('aria-checked', String(settings.mute));
}
syncMute();

beginBtn.addEventListener('click', () => {
  const open = menu.hidden;
  show(menu, open);
  beginBtn.setAttribute('aria-expanded', String(open));
  beginBtn.classList.toggle('pressed', open);
});
menu.addEventListener('click', (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (!item) return;
  if (item.dataset.menu === 'mute') {
    settings.mute = !settings.mute;
    sfx.setMuted(settings.mute);
    saveSettings(settings);
    syncMute();
  } else if (item.dataset.menu === 'about') {
    show(about, true);
    $<HTMLButtonElement>('.about-ok').focus();
  }
  closeMenu();
});
$('.about-ok').addEventListener('click', () => show(about, false));
desktop.addEventListener('pointerdown', (e) => {
  const t = e.target as HTMLElement;
  if (!menu.hidden && !t.closest('.menu') && !t.closest('.begin')) closeMenu();
});

// ---------- effects ----------
function handleFx(events: readonly FxEvent[]): void {
  for (const e of events) {
    switch (e.t) {
      case 'spawn':
        sfx.spawn(e.kind);
        break;
      case 'close':
        sfx.close();
        break;
      case 'combo':
        sfx.combo(e.n);
        break;
      case 'wave':
        sfx.wave();
        break;
      case 'crash':
        sfx.crash();
        break;
      default:
        break;
    }
  }
  fx.handle(events, performance.now());
}

// ---------- results count-up ----------
const COUNT_MS = 800;
let countStart = 0;
function paintResults(now: number): void {
  const el = now - countStart;
  $('.results-time').textContent = SYSTEM.survived(formatClock(countUp(survivalMs(state), el, COUNT_MS)));
  $('.results-closes').textContent = SYSTEM.closes(countUp(state.closes, el, COUNT_MS));
  $('.results-points').textContent = SYSTEM.points(countUp(state.points, el, COUNT_MS));
  $('.results-combo').textContent = SYSTEM.bestCombo(Math.max(1, countUp(state.bestCombo, el, COUNT_MS)));
}

/** The parts of the results panel that don't count up. */
function paintResultsOnce(): void {
  const n = puzzleNumber(runDay);
  $('.results-mode').textContent =
    mode === 'endless'
      ? SYSTEM.runEndless
      : rankedRun
        ? SYSTEM.runPractice(n, formatClock(rankedRun.timeMs))
        : SYSTEM.runRanked(n);
  show($('.results-best'), isNewBest);
  $('.results-strip').textContent = lastRun?.strip ?? '';
  show($('.results-next'), mode === 'daily');
  paintCountdown();
}

let countdownText = '';
function paintCountdown(): void {
  if (mode !== 'daily') return;
  const t = SYSTEM.nextDaily(formatCountdown(msUntilNextDay(new Date())));
  if (t !== countdownText) $('.results-next').textContent = countdownText = t;
}

// ---------- share ----------
let toastTimer = 0;
function hideShareUi(): void {
  clearTimeout(toastTimer);
  show($('.toast'), false);
  show($('.results-copy'), false);
}

function currentShareText(): string {
  const r = lastRun!;
  return shareText({
    puzzle: mode === 'daily' ? puzzleNumber(runDay) : null,
    timeMs: r.timeMs,
    closes: r.closes,
    bestCombo: r.bestCombo,
    strip: r.strip,
  });
}

async function share(): Promise<void> {
  if (!lastRun) return;
  const text = currentShareText();
  // Web Share on touch devices (phones); desktop browsers that have it still get the clipboard.
  if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // the player closed the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    hideShareUi();
    show($('.toast'), true);
    toastTimer = window.setTimeout(() => show($('.toast'), false), TOAST_MS);
  } catch {
    // No clipboard (http, permissions): show the text so it can be copied by hand.
    const box = $<HTMLTextAreaElement>('.results-copy textarea');
    box.value = text;
    show($('.results-copy'), true);
    box.select();
  }
}

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  if (phase === 'run') {
    acc += now - last;
    let steps = 0;
    while (acc >= MS_PER_TICK && steps < MAX_STEPS_PER_FRAME) {
      state = step(state, input.drain(state));
      ramSamples.push(state.ram);
      acc -= MS_PER_TICK;
      steps++;
      if (state.status === 'crashed') break;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    renderer.render(state);
    handleFx(fxEvents(prevState, state));
    fx.frame(state, now);
    if (state.status === 'running') sfx.alarm(ramPercent(state), now);
    prevState = state;
    if (state.status === 'crashed') enterCrash();
  }
  if (phase === 'results') {
    if (now - countStart <= COUNT_MS + 50) paintResults(now);
    paintCountdown();
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
