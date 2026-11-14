// Registry of per-kind behaviour modules (SPEC §4).
import type { KindTable } from '../world';
import { ad } from './ad';
import { fakeX } from './fakeX';
import { prize } from './prize';
import { toolbar } from './toolbar';
import { virusScan } from './virusScan';

export const KINDS: KindTable = {
  ad,
  fakeX,
  runner: {},
  prize,
  virusScan,
  confirm: {},
  toolbar,
  antivirus: {},
};
