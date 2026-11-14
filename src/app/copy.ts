// In-game text from docs/COPY.md. Lines are picked from (seed, window id), so a seed reads the same for everyone.
import { hashSeed, type PopupKind } from '../sim';

export interface PopupCopy {
  title: string;
  body: string;
}

export const POPUP_COPY: Record<PopupKind, readonly PopupCopy[]> = {
  ad: [
    { title: 'HOT SINGLES', body: 'Hot single-core processors in your area want to compute with you.' },
    { title: 'DOWNLOAD MORE RAM', body: '100% legal. 0% possible. Click now!' },
    { title: 'Your PC is SLOW', body: 'Have you tried being faster?' },
    { title: "Grandma's Secret", body: 'Local grandma discovers one weird trick. Engineers hate her.' },
    { title: 'Cursor Polish™', body: 'Is your cursor dull? Make it SHINY.' },
    { title: 'Free Screensaver', body: '4,000 dolphins. All of them jumping. Forever.' },
    { title: 'BEANS', body: 'We have beans. Do you want beans? Click if beans.' },
    { title: 'Mouse Hungry', body: 'Your mouse has not eaten today. Feed it a click.' },
    { title: 'Ugly Font Pack', body: '900 fonts and every one is Comic.' },
    { title: 'Hamster Upgrade', body: 'Your CPU is powered by 1 hamster. Upgrade to 2.' },
    { title: 'Webcam Detected', body: 'Wow. Nice lamp.' },
    { title: 'Dial-Up Deluxe', body: 'Now with 30% more screeching.' },
  ],
};

export function pickCopy(seed: number, id: number, kind: PopupKind): PopupCopy {
  const list = POPUP_COPY[kind];
  return list[hashSeed(`${seed}:${id}`) % list.length]!;
}

export const SYSTEM = {
  titlePrompt: 'Press any key to boot PanicOS 97',
  boot: [
    'PanicOS 97 (build 0xBEEF)',
    'Checking RAM… 640K ought to be… loading…',
    'Loading pop-up drivers… OK',
    'Mounting C:\\REGRETS… OK',
  ],
  bootSkip: 'Press any key to skip',
  hang: (t: number) => `PanicOS is not responding… ${t}`,
  crashTitle: 'A fatal exception 0xPANIC has occurred.',
  crashBody: 'Your computer was ad-ministered to death.',
  crashPrompt: 'Press any key to pretend this never happened.',
  resultsTitle: 'Run Report',
  survived: (t: string) => `You survived ${t}`,
  closes: (n: number) => `${n} pop-up${n === 1 ? '' : 's'} closed`,
  points: (n: number) => `${n} point${n === 1 ? '' : 's'}`,
  retry: 'Retry',
  menuMute: 'Mute',
  menuAbout: 'About PanicOS',
  aboutTitle: 'About PanicOS 97',
  aboutBody: 'PanicOS 97. Now with 40% fewer crashes than PanicOS 96. Results not typical.',
  aboutOk: 'Sure',
} as const;
