// Registry of per-kind behaviour modules (SPEC §4).
import type { KindTable } from '../world';
import { ad } from './ad';
import { antivirus } from './antivirus';
import { confirm } from './confirm';
import { fakeX } from './fakeX';
import { prize } from './prize';
import { runner } from './runner';
import { toolbar } from './toolbar';
import { virusScan } from './virusScan';

export const KINDS: KindTable = { ad, fakeX, runner, prize, virusScan, confirm, toolbar, antivirus };
