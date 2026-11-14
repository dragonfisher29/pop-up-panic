// In-game text from docs/COPY.md. Lines are picked from (seed, window id), so a seed reads the same for everyone.
import { hashSeed, type PopupKind } from '../sim';

export interface PopupCopy {
  title: string;
  body: string;
  /** fakeX only: the real close link */
  link?: string;
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
  fakeX: [
    { title: 'CONGRATULATIONS', body: 'You are visitor 1,000,000! (Again!)', link: "no thanks, I hate prizes" },
    { title: 'Survey (1 min)', body: 'Rate this pop-up from 1 to pop-up.', link: 'no thanks, I have opinions elsewhere' },
    { title: 'Coupon!!', body: '10% off the next pop-up.', link: 'no thanks, I pay full price' },
    { title: 'Newsletter', body: 'Get pop-ups by email too!', link: 'no thanks, my inbox is a temple' },
    { title: 'Cookies?', body: "We baked cookies. They track you. They're delicious.", link: "no thanks, I'm on a diet" },
  ],
  runner: [
    { title: 'Catch Me!', body: "You'll never close me, I'm too fast." },
    { title: 'Shy Window', body: "Please don't look at me." },
    { title: 'Window.exe has legs', body: 'Nobody knows how.' },
    { title: 'Speedy Deals', body: 'These deals move FAST. Literally.' },
  ],
  prize: [
    { title: 'YOU WON A YACHT', body: 'Claim within {t}s or it sinks.' },
    { title: 'FREE CAR', body: "It's a toy car. Claim within {t}s." },
    { title: 'MYSTERY BOX', body: 'The box is also a pop-up. {t}s left.' },
    { title: '1,000,000 POINTS', body: 'Points for what? {t}s to find out.' },
  ],
  virusScan: [
    { title: 'Scanning…', body: '3,402 viruses found. 3,403. 3,404…' },
    { title: 'Virus Scan Pro', body: 'Your files look sick. Have they tried soup?' },
    { title: 'THREAT DETECTED', body: "It's you. You're the threat." },
    { title: 'Deep Scan', body: 'Scanning your hopes and dreams… 2%' },
  ],
  confirm: [
    { title: 'Close window?', body: 'Are you sure you want to close this window?' },
    { title: 'Really?', body: 'Like, really really sure?' },
    { title: 'Final answer?', body: "We'll be very sad." },
  ],
  toolbar: [{ title: 'Install SuperSearch Bar', body: 'Search faster by searching more.' }],
  antivirus: [
    { title: 'Guardian Llama AV', body: 'I eat pop-ups. Do not close me. Please.' },
    { title: 'Friendly Firewall', body: "I'm on your side! Mostly!" },
  ],
};

export const STRIP_NAMES = ['🔍 SuperSearch', '💰 CouponBuddy', '🌦 WeatherDuck', '🎵 BeepRadio'] as const;

export const KIND_LABEL: Record<PopupKind, string> = {
  ad: 'Ads',
  fakeX: 'Fake X',
  runner: 'Runner',
  prize: 'Prize',
  virusScan: 'Virus Scan',
  confirm: 'Confirm',
  toolbar: 'Toolbar',
  antivirus: 'Antivirus',
};

/** Copy for a window. Confirm dialogs read by chain stage; the final stage always reads "Final answer?". */
export function pickCopy(seed: number, id: number, kind: PopupKind, stage = 0, stageCount = 0): PopupCopy {
  const list = POPUP_COPY[kind];
  if (kind === 'confirm') {
    const last = stageCount > 0 && stage === stageCount - 1;
    return list[last ? list.length - 1 : Math.min(stage, list.length - 2)]!;
  }
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
