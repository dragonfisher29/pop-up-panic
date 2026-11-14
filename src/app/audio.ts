// WebAudio synth (no audio files). Presentation only; never touches sim state.
import type { PopupKind } from '../sim';

const MASTER_VOLUME = 0.25;
const ALARM_FROM_PCT = 75;

const BLIP: Record<PopupKind, number> = {
  ad: 520,
  fakeX: 440,
  runner: 660,
  prize: 784,
  virusScan: 330,
  confirm: 392,
  toolbar: 587,
  antivirus: 262,
};

export function blipFreq(kind: PopupKind): number {
  return BLIP[kind];
}

/** Pentatonic-ish climb from 523 Hz; n is capped so it never gets shrill. */
const COMBO_STEPS = [0, 2, 4, 7, 9, 12, 14, 16];
export function comboFreq(n: number): number {
  const i = Math.max(0, Math.min(COMBO_STEPS.length - 1, Math.floor(n) - 2));
  return Math.round(523 * 2 ** ((COMBO_STEPS[i] ?? 0) / 12));
}

/** Pulse period in ms: null at or below 75% RAM, 900 at 76% down to 250 at 100%+ (max 4 pulses/s). */
export function alarmPeriodMs(ramPct: number): number | null {
  if (ramPct <= ALARM_FROM_PCT) return null;
  const r = Math.min(100, ramPct);
  return Math.round(900 - ((r - 76) * 650) / 24);
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private nextAlarmMs = 0;

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(b: boolean): void {
    this.muted = b;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(b ? 0 : MASTER_VOLUME, t + 0.03);
  }

  spawn(kind: PopupKind): void {
    this.tone('square', blipFreq(kind), 0.07, 0.25);
  }

  close(): void {
    this.noise(0.03, 0.22, 4000, 'highpass');
  }

  combo(n: number): void {
    this.tone('triangle', comboFreq(n), 0.16, 0.4);
  }

  wave(): void {
    [523, 659, 784].forEach((f, i) => this.tone('triangle', f, 0.14, 0.4, i * 0.12));
  }

  alarm(ramPct: number, nowMs: number): void {
    const period = alarmPeriodMs(ramPct);
    if (period === null) {
      this.nextAlarmMs = 0;
      return;
    }
    if (nowMs < this.nextAlarmMs) return;
    this.nextAlarmMs = nowMs + period;
    this.tone('sine', 140, 0.12, 0.35);
  }

  crash(): void {
    const c = this.ctx;
    const m = this.master;
    if (!c || !m) return;
    const t = c.currentTime;
    for (const f of [440, 554, 659]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f / 8, t + 1.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      o.connect(g).connect(m);
      o.start(t);
      o.stop(t + 1.3);
    }
    // modem screech: band-passed noise whose centre sweeps
    this.noise(1.1, 0.3, 1800, 'bandpass', 0.05, (f, at) => {
      f.frequency.setValueAtTime(1200, at);
      f.frequency.linearRampToValueAtTime(2800, at + 0.3);
      f.frequency.linearRampToValueAtTime(1500, at + 0.6);
      f.frequency.linearRampToValueAtTime(3200, at + 1.0);
      f.Q.value = 6;
    });
  }

  private tone(type: OscillatorType, freq: number, dur: number, vol: number, delay = 0): void {
    const c = this.ctx;
    const m = this.master;
    if (!c || !m) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(m);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    vol: number,
    freq: number,
    type: BiquadFilterType,
    delay = 0,
    tune?: (f: BiquadFilterNode, at: number) => void,
  ): void {
    const c = this.ctx;
    const m = this.master;
    if (!c || !m) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1; // audio only, not sim
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    tune?.(f, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(m);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
