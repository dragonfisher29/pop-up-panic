// Boot, screens (title → boot crawl → run → crash → results) and the fixed-timestep loop.
import { guard } from './guard'; // first, so its error listeners are up before anything else runs
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
  encodeInput,
  fetchBoard,
  newPicker,
  pickerKey,
  pickerTap,
  submitScore,
  type Board,
  type LogEntry,
  type Picker,
} from './leaderboard';
import {
  clearPending,
  loadBest,
  loadDaily,
  loadInitials,
  loadPending,
  loadSettings,
  saveBest,
  saveDailyIfFirst,
  saveInitials,
  savePending,
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
      <div class="board-slot">
        <section class="board" aria-label="${SYSTEM.boardTitle}">
          <div class="board-tabs" role="tablist">
            <button class="board-tab" type="button" role="tab" data-board="today">${SYSTEM.boardToday}</button>
            <button class="board-tab" type="button" role="tab" data-board="yesterday">${SYSTEM.boardYesterday}</button>
          </div>
          <ol class="board-list"></ol>
          <p class="board-note" role="status"></p>
        </section>
      </div>
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
          <div class="picker" tabindex="0" hidden aria-label="${SYSTEM.pickerPrompt}">
            <p class="picker-prompt">${SYSTEM.pickerPrompt}</p>
            <div class="wheels">
              ${[0, 1, 2]
                .map(
                  (i) => `<div class="wheel" data-wheel="${i}">
                <button class="btn wheel-up" type="button" tabindex="-1" aria-label="Previous letter">▲</button>
                <span class="wheel-letter">A</span>
                <button class="btn wheel-down" type="button" tabindex="-1" aria-label="Next letter">▼</button>
              </div>`,
                )
                .join('')}
              <button class="btn picker-send" type="button">${SYSTEM.pickerSend}</button>
            </div>
            <p class="picker-hint">${SYSTEM.pickerHint}</p>
            <p class="picker-status" role="status"></p>
          </div>
          <div class="results-copy" hidden><p>${SYSTEM.copyFailed}</p><textarea readonly rows="2"></textarea></div>
          <div class="results-actions">
            <button class="btn share" type="button">${SYSTEM.share}</button>
            <button class="btn retry" type="button">${SYSTEM.retry}</button>
            <button class="btn to-menu" type="button">${SYSTEM.menu}</button>
          </div>
          <p class="toast" role="status" hidden>${SYSTEM.copied}</p>
        </div>
      </div>
      <div class="dialog board-dialog" role="region" aria-labelledby="board-title">
        <div class="titlebar"><span class="title" id="board-title">${SYSTEM.boardTitle}</span></div>
        <div class="body board-slot"></div>
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
const pickerEl = $('.picker');
const board = $('.board');

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
/** Every input of the current run as `[tick, type, ...fields]`, ending with `[crashTick, 'end']`. */
let inputLog: LogEntry[] = [];
let boardTab: 'today' | 'yesterday' = 'today';
let boardReq = 0;
let picker: Picker = newPicker(null);
let sending = false;
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
  enterBoard(titleScreen, 'today');
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
    if (saveDailyIfFirst(daily)) {
      inputLog.push([state.tick, 'end']);
      savePending({ day: runDay, timeMs: run.timeMs, points: run.points, closes: run.closes, inputLog });
    } else rankedRun = loadDaily(runDay);
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
  inputLog = [];
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
  const daily = mode === 'daily';
  show($('.board-dialog'), daily);
  if (daily) enterBoard(results, runDay === dayKey(new Date()) ? 'today' : 'yesterday');
  openPicker();
}

function onAnyKey(): void {
  if (phase === 'title') pickMode(mode);
  else if (phase === 'boot') startRun();
  else if (phase === 'crash') showResults();
}

window.addEventListener('keydown', (e) => {
  // Held arrows spin the initials wheels; every other key ignores auto-repeat.
  if (e.repeat && !(phase === 'results' && document.activeElement === pickerEl && e.key.startsWith('Arrow'))) return;
  if (e.key === 'Escape') closeMenu();
  if (phase === 'results') {
    // Enter/Space activate the focused button (Retry by default); Escape goes back to the title.
    if (e.key === 'Escape') showTitle();
    else if (document.activeElement === pickerEl && onPickerKey(e.key)) e.preventDefault();
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

// ---------- leaderboard ----------
const yesterdayKey = (): string => dayKey(new Date(Date.now() - 86_400_000));

/** Moves the one board element into the title screen or the results window, then loads it. */
function enterBoard(host: HTMLElement, tab: 'today' | 'yesterday'): void {
  host.querySelector('.board-slot')!.append(board);
  boardTab = tab;
  void retryPending().then(refreshBoard);
}

async function refreshBoard(): Promise<void> {
  const req = ++boardReq;
  for (const t of board.querySelectorAll<HTMLButtonElement>('.board-tab')) {
    t.setAttribute('aria-selected', String(t.dataset.board === boardTab));
  }
  const day = boardTab === 'today' ? dayKey(new Date()) : yesterdayKey();
  const list = $('.board-list');
  const note = $('.board-note');
  list.replaceChildren();
  note.textContent = SYSTEM.boardLoading;
  const me = loadInitials();
  const b = await fetchBoard(day, me);
  if (req !== boardReq) return; // a newer refresh started
  if (!b) {
    note.textContent = SYSTEM.boardOffline;
    return;
  }
  paintBoard(b);
  note.textContent = b.top.length === 0 ? SYSTEM.boardEmpty : loadPending(day) ? SYSTEM.boardUnsent : '';
}

function paintBoard(b: Board): void {
  const row = (r: Board['top'][number], mine: boolean): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = mine ? 'board-row mine' : 'board-row';
    li.innerHTML = `<span class="rank">${r.rank}</span><span class="who"></span><span class="time">${formatClock(r.timeMs)}</span>`;
    li.querySelector('.who')!.textContent = r.initials;
    return li;
  };
  const me = b.me;
  const isMe = (r: Board['top'][number]) => me !== null && r.rank === me.rank && r.initials === me.initials;
  const rows = b.top.map((r) => row(r, isMe(r)));
  if (me && !b.top.some(isMe)) {
    const gap = document.createElement('li');
    gap.className = 'board-gap';
    gap.textContent = '⋮';
    rows.push(gap, row(me, true));
  }
  $('.board-list').replaceChildren(...rows);
  $('.board-row.mine')?.scrollIntoView({ block: 'nearest' });
}

for (const t of board.querySelectorAll<HTMLButtonElement>('.board-tab')) {
  t.addEventListener('click', () => {
    boardTab = t.dataset.board as 'today' | 'yesterday';
    void refreshBoard();
  });
}

/** Silently sends any unsent ranked run (today's or yesterday's) when the initials are already known. */
async function retryPending(): Promise<void> {
  const initials = loadInitials();
  if (!initials || sending) return;
  for (const day of [dayKey(new Date()), yesterdayKey()]) {
    if (phase === 'results' && day === runDay) continue; // the picker on screen handles this one
    const p = loadPending(day);
    if (!p) continue;
    const r = await submitScore({ ...p, initials });
    if (r.ok || r.reason !== 'offline') clearPending(day);
  }
}

/** Shows the initials picker when this run's day still has an unsent ranked run. */
function openPicker(): void {
  const pending = mode === 'daily' ? loadPending(runDay) : null;
  show(pickerEl, pending !== null);
  if (!pending) return;
  picker = newPicker(loadInitials());
  $('.picker-status').textContent = '';
  paintPicker();
  pickerEl.focus();
}

function paintPicker(): void {
  pickerEl.querySelectorAll<HTMLElement>('.wheel').forEach((w, i) => {
    w.querySelector('.wheel-letter')!.textContent = picker.letters[i]!;
    w.classList.toggle('on', i === picker.cursor);
  });
}

function onPickerKey(key: string): boolean {
  const r = pickerKey(picker, key);
  const handled = r.picker !== picker || r.submit !== null || r.blocked;
  picker = r.picker;
  paintPicker();
  if (r.blocked) $('.picker-status').textContent = SYSTEM.pickerBlocked;
  if (r.submit) void sendRun(r.submit);
  return handled;
}

async function sendRun(initials: string): Promise<void> {
  const p = loadPending(runDay);
  if (!p || sending) return;
  sending = true;
  const status = $('.picker-status');
  status.textContent = SYSTEM.pickerSending;
  saveInitials(initials);
  const r = await submitScore({ ...p, initials });
  sending = false;
  if (r.ok) {
    clearPending(runDay);
    show(pickerEl, false);
    $('.board-note').textContent = '';
    $('.results-mode').textContent = `${$('.results-mode').textContent} · ${SYSTEM.pickerSent(r.rank)}`;
    $<HTMLButtonElement>('.retry').focus();
    void refreshBoard();
    return;
  }
  if (r.reason !== 'offline') clearPending(runDay);
  status.textContent = r.reason === 'rate' ? SYSTEM.pickerRate : r.reason === 'rejected' ? SYSTEM.pickerRejected : SYSTEM.pickerOffline;
}

pickerEl.querySelectorAll<HTMLElement>('.wheel').forEach((w, i) => {
  const wheel = i as 0 | 1 | 2;
  w.querySelector('.wheel-up')!.addEventListener('click', () => {
    picker = pickerTap(picker, wheel, -1);
    pickerEl.focus();
    paintPicker();
  });
  w.querySelector('.wheel-down')!.addEventListener('click', () => {
    picker = pickerTap(picker, wheel, 1);
    pickerEl.focus();
    paintPicker();
  });
});
$('.picker-send').addEventListener('click', () => onPickerKey('Enter'));

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  if (guard.tripped) return;
  try {
    tick(now);
  } catch (err) {
    guard.trip(err);
    return;
  }
  requestAnimationFrame(frame);
}

function tick(now: number): void {
  // Dev only: `?panic` throws on the first run frame to check the Blue Screen of Panic.
  if (import.meta.env.DEV && phase === 'run' && new URLSearchParams(location.search).has('panic')) {
    throw new Error('?panic test');
  }
  if (phase === 'run') {
    acc += now - last;
    let steps = 0;
    while (acc >= MS_PER_TICK && steps < MAX_STEPS_PER_FRAME) {
      const ins = input.drain(state);
      for (const i of ins) inputLog.push(encodeInput(state.tick, i));
      state = step(state, ins);
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
}
requestAnimationFrame(frame);

enterBoard(titleScreen, 'today');
