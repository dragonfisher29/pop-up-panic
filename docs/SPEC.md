# Pop-Up Panic — Game Spec

> Owner-controlled document. Claude Code reads it but must not edit it (a hook blocks edits).
> Tuning numbers live in `src/sim/constants.ts`; the values here are the starting targets.

## 1. Pitch
A fake 90s desktop, **PanicOS 97**, is being buried in absurd pop-ups. Close them faster than they spawn.
If memory sits at 100% for 2 seconds the machine crashes and your run ends. Runs last about 2 minutes,
there's a new daily seed for everyone, and a global leaderboard of 3-letter arcade initials.

- **Audience:** desktop first (mouse + keyboard). Mobile is playable but not the main target.
- **Tone:** absurd comedy. Every window is a joke (see `docs/COPY.md`).
- **The 30-second wow:** the desktop fills up, the RAM bar goes red, the alarm speeds up, then CRASH, then "You survived 1:34".

## 2. Core loop
1. A run starts on a clean desktop with RAM at 10% (the OS base).
2. The spawn director opens pop-ups at an ever faster rate, and new types unlock in waves.
3. Each open window holds RAM. Most windows **leak**, using more RAM the longer they stay open.
4. Closing a window frees its RAM immediately.
5. **Hang:** at 100% RAM the screen shows "PanicOS is not responding…" with a 2-second fuse. Drop below 100% to cancel the fuse.
6. When the fuse runs out you get the crash screen, then results, then share or retry.

### Units (simulation)
- Fixed tick: **60 Hz**. One run of 2 minutes is 7,200 ticks.
- RAM is an integer in **milli-percent**: `100_000` = 100%.
- The virtual desktop is **1280 × 720** integer pixels. The renderer scales it to fit the screen. The taskbar is 32 px at the bottom.

## 3. Scoring
- **Primary:** time survived, in ms (derived from ticks). This decides leaderboard rank.
- **Secondary:** points. Each close adds `combo` points.
- **Combo:** closing a window within 600 ms (36 ticks) of the previous close raises combo by 1, up to ×8. Otherwise combo resets to ×1.
- **Tie-break order:** time survived, then points, then earlier submission.

## 4. Pop-up types
Each type has a footprint (starting RAM), a leak rate and a cap. All values are in percent.

| # | Kind (`PopupKind`) | Unlocks at | Size (px) | RAM start / leak per s / cap | Twist | Counter |
|---|---|---|---|---|---|---|
| 1 | `ad` | 0 s | 260×160 | 4 / 0.5 / 8 | Plain annoying ad | Click the X |
| 2 | `fakeX` | 15 s | 280×170 | 4 / 0.5 / 8 | The big X is fake and **spawns another ad** | Click the tiny "no thanks" link |
| 3 | `runner` | 30 s | 220×140 | 5 / 0.6 / 9 | Slides away when the cursor comes within 90 px (speed 6 px/tick, bounded by the desktop) | Trap it in a corner, or use Force Quit |
| 4 | `prize` | 45 s | 300×190 | 3 / 0 / 3 | "YOU WON!" with a 3-second countdown; at 0 it **spawns 4 ads** and closes | Close it before the timer ends |
| 5 | `virusScan` | 60 s | 320×180 | 6 / 0.4 / 10 | Closing it with X **spawns 2 more `virusScan`** | Click "Cancel scan" |
| 6 | `confirm` | 75 s | 240×120 | 2 / 0 / 2 | Closing opens "Are you sure?", then "Really sure?" (a chain of 2–3) | Click through quickly; the last one closes all of them |
| 7 | `toolbar` | 90 s | installer 300×200 | 3 / 0 / 3 | When the installer closes, a toolbar strip (40 px) attaches to the top of the desktop. This shrinks the play area and spawns are squeezed into it. Max 4 strips | Click the toolbar's tray icon to uninstall it (1 click per strip) |
| 8 | `antivirus` | 20 s, rare (1 in 25 spawns) | 240×150 | 6 / 0 / 6 | **Friendly.** Every 4 seconds it closes the oldest hostile window | Leave it open. Closing it costs +15% RAM as a 1-second spike |

**Telegraphing rule:** every trick gets a 300 ms tell before it acts. The fake X wobbles on hover and the runner's title bar flashes before it moves. A trick that can't be read is unfair; a trick that can be read is funny.

**Stretch types (only if ahead of schedule):** `banner` (a full-width flashing strip), `notResponding` (ignores clicks for 1 second), `dragger` (walks itself around the screen).

## 5. Spawn director
- The spawn interval eases from **1,500 ms down to 250 ms** over the first 150 s (ease-out), then stays at 250 ms.
- **Bursts:** every 25 s, 3–5 windows spawn within 400 ms, together with the wave's "new type" fanfare.
- Spawn positions are random within the available desktop area (taking toolbars into account), and windows may overlap.
- Type choice is a weighted pick from the unlocked types, with the newest type weighted ×2 for 10 s after it unlocks.
- **Target for the M2 playtest:** a first-time player dies between 60 and 120 s, and a practised player reaches 150–200 s.

## 6. Panic tools
Real Alt+F4 and Ctrl+Alt+Del can't be used: the browser or the OS grabs them first. They're shown on screen as keycaps but bound to safe keys.

| Tool | Key | Effect | Charges |
|---|---|---|---|
| **Force Quit** (shown as `ALT+F4`) | Space, or right-click | Closes the window under the cursor (or the topmost window) instantly and skips its trick | 3, +1 every 45 s, max 3 |
| **Task Manager** (shown as `CTRL+ALT+DEL`) | Shift | Closes every hostile window with a 1.5 s "End Task ×37" flash | 1 per run |

## 7. Modes
- **Daily:** the seed comes from the UTC date. Your first completed run of the day is **ranked** and submitted; later runs that day are practice and stay local. The puzzle number is the number of days since launch.
- **Endless:** a random seed and a local best score only.
- **Share text:**
  ```
  Pop-Up Panic #12 — 1:34 💾 87 closes 🔥x6
  🟩🟩🟨🟨🟧🟥🟥💥
  ```
  The emoji strip shows your RAM level in 8 equal slices of the run (under 50% 🟩, 50–75% 🟨, 75–90% 🟧, over 90% 🟥, crash 💥).

## 8. Leaderboard
- **Identity:** 3-letter arcade initials (A–Z), entered on a retro letter-picker. A blocklist of rude 3-letter words is checked on both the client and the server.
- **Boards:** today's top 100 and yesterday's top 100. Players see their own rank even outside the top 100.
- **Submission:** `{ day, initials, timeMs, points, closes, inputLog }`. Validation is described in `docs/ARCHITECTURE.md` §6.

## 9. Look and feel
- **PanicOS 97 is an original retro OS.** Never use Microsoft or Windows logos, names, the four-colour flag, or the exact Start button. The start button says **"Begin"**.
- **Palette:** desktop `#0f7d7a`, window face `#c3c3c3`, bevel light `#ffffff` and dark `#7b7b7b`, title bar gradient `#0a1a6b` → `#2f5fd0`, alert red `#d4282c`, CRT green `#33ff66`.
- **Fonts:** Pixelify Sans (OFL, self-hosted with `@fontsource`) for titles and the HUD, a system sans-serif for body text.
- **HUD (in the taskbar):** "Begin" button, RAM bar with a % label, Force Quit charges, Task Manager status, a run clock in the tray, and the combo counter.
- **Effects:** windows pop in with a 4-frame scale-up, closes give a tiny puff, screen shake above 80% RAM (turned off by reduced-motion), a cursor trail, a red vignette during a hang, and a CRT-scanline crash screen.

## 10. Sound
All sound is generated with WebAudio, so there are no audio files.
- A spawn blip pitched per window type, a close click, a rising arpeggio as combo climbs, and a soft alarm whose pulse rate follows RAM above 75%.
- The crash is a falling chord plus a burst of noise that sounds like a modem screech.
- The mute toggle is saved between visits. Audio starts on the first click (a browser rule).

## 11. Mobile (playable, not polished)
- Taps work like clicks. The runner dodges a 90 px circle around where you touch down.
- Force Quit and Task Manager become on-screen buttons. Tap targets are at least 44 px.
- Portrait shows a "rotate your device" hint. Landscape scales the desktop to fit.

## 12. Accessibility
- The RAM bar always shows the number, so colour isn't the only signal.
- Reduced-motion turns off shake, the trail and pop-in scaling.
- Volume and mute settings. The game never flashes more than 3 times per second.

## 13. Out of scope (this weekend)
Accounts, multiplayer, a level editor, in-app purchases, localisation, server-side replays of other players.
