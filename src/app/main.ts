// Boot, screens (title → boot crawl → run → crash → results) and the fixed-timestep loop.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles.css';
import { createGame, DESKTOP_H, DESKTOP_W, MS_PER_TICK, step, survivalMs, type GameState } from '../sim';
import { SYSTEM } from './copy';
import { InputCapture } from './input';
import { fitDesktop, formatClock } from './layout';
import { Renderer } from './render';
import { loadSettings, saveSettings } from './storage';

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
      <p class="blink">${SYSTEM.titlePrompt}</p>
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
          <p class="results-time"></p>
          <ul class="results-stats"><li class="results-closes"></li><li class="results-points"></li></ul>
          <button class="btn retry" type="button">${SYSTEM.retry}</button>
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
const input = new InputCapture(desktop);
const settings = loadSettings();

let phase: Phase = 'title';
let state: GameState = createGame(newSeed());
let crashAt = 0;
let bootTimers: number[] = [];

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
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
  state = createGame(newSeed());
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
  show(crashScreen, true);
}

function showResults(): void {
  if (performance.now() - crashAt < CRASH_LOCK_MS) return;
  phase = 'results';
  show(crashScreen, false);
  $('.results-time').textContent = SYSTEM.survived(formatClock(survivalMs(state)));
  $('.results-closes').textContent = SYSTEM.closes(state.closes);
  $('.results-points').textContent = SYSTEM.points(state.points);
  show(results, true);
  $<HTMLButtonElement>('.retry').focus();
}

function onAnyKey(): void {
  if (phase === 'title') boot();
  else if (phase === 'boot') startRun();
  else if (phase === 'crash') showResults();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape') closeMenu();
  if (phase === 'results') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startRun();
    }
    return;
  }
  if (phase === 'run') {
    if (input.key(e)) e.preventDefault();
    return;
  }
  onAnyKey();
});
window.addEventListener('keyup', (e) => {
  if (phase === 'run' && e.key === ' ') e.preventDefault(); // no button activation on Space release
});
for (const el of [titleScreen, bootScreen, crashScreen]) el.addEventListener('pointerdown', onAnyKey);
$('.retry').addEventListener('click', startRun);

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

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  if (phase === 'run') {
    acc += now - last;
    let steps = 0;
    while (acc >= MS_PER_TICK && steps < MAX_STEPS_PER_FRAME) {
      state = step(state, input.drain(state));
      acc -= MS_PER_TICK;
      steps++;
      if (state.status === 'crashed') break;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    renderer.render(state);
    if (state.status === 'crashed') enterCrash();
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
