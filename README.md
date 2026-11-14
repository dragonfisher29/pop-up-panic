# Pop-Up Panic

> Close the pop-ups before PanicOS 97 runs out of memory.

**Play it:** https://pop-up-panic.pages.dev

![Pop-Up Panic gameplay](docs/demo.gif)
<!-- Record with ScreenToGif: ~10 s, 800 px wide, one run from calm desktop to crash screen. Save as docs/demo.gif. -->

A single-player arcade game in the browser about a cursed 90s desktop. Every pop-up eats RAM; hit 100% and PanicOS 97 crashes. There's a new daily seed every day, a global leaderboard, and an Endless mode for practice. Built in one weekend with Claude Code.

## How to play
- **Close pop-ups** by clicking (or tapping) their X. Some of them fight back:
  - **Fake X:** the big red X is a lie. Click the tiny "no thanks" link.
  - **Runner:** slides away from your cursor. Corner it, or Force Quit it.
  - **YOU WON!:** close it before its countdown ends, or it brings friends.
  - **Virus scan:** closing it with X spawns two more. Press "Cancel scan".
  - **Are you sure?:** a chain of confirms. Click through fast.
  - **Toolbar installer:** leaves a toolbar that squeezes your desk. Click its tray icon to uninstall.
  - **Antivirus:** the one friendly window. Leave it open; it closes things for you.
- Every trick flashes a 300 ms warning first. If you saw it coming, it's fair.
- **Panic tools:**
  - `ALT+F4` (Force Quit): **Space** or **right-click**, or tap the button. Closes the window under the cursor. 3 charges, +1 every 45 s.
  - `CTRL+ALT+DEL` (Task Manager): **Shift**, or tap the button. Closes every hostile window. Once per run.
- **Daily:** everyone gets the same seed. Your first run of the day is ranked and goes on the wall; later runs are practice.
- **Share:** your run as an emoji RAM strip, ready for WhatsApp or Discord.
- Phones work in landscape. Taps work like clicks, and the runner dodges a 90 px circle around your touch.

## Tech notes
- **Vite + TypeScript, no framework.** The desktop is one 1280×720 `div` scaled to fit the screen; windows are plain DOM nodes keyed by id.
- **Deterministic simulation.** `src/sim/` is pure: integers only (px, milli-percent RAM, 60 Hz ticks), one seeded RNG, no DOM, no `Date`, no `Math.random`. `step(state, inputs)` never mutates its input. The same seed and inputs always give the same run, which is what makes a fair daily seed and replayable runs possible.
- **Fixed-timestep loop.** `requestAnimationFrame` feeds an accumulator that steps the sim at exactly 60 Hz; the renderer only reads state. Effects (shake, puffs, trail, crash CRT) live in the app layer and respect reduced motion.
- **Sound** is synthesized with WebAudio. There are no audio files.
- **Leaderboard:** Cloudflare Pages Functions + D1. Each ranked run sends its full input log, so a run can be re-checked later. Initials go through a blocklist, and submits are rate-limited per day.
- **Tests:** Vitest, 150+ tests, most of them on the sim (each pop-up type, the spawn director, determinism). A small balance bot (`npm run sim:bot`) plays 200 seeded runs to tune difficulty.
- **Error guard:** if anything throws, you get a "Blue Screen of Panic" with a Reboot button instead of a dead page.
- PanicOS 97 is an original fake OS. No real OS names, logos or UI were harmed.

## Run it locally (Windows, PowerShell)
```powershell
cd C:\Users\nadth\Documents\FUN\pop-up-panic
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
npm run dev
```
`npm run dev` · `npm test` · `npm run test:sim` · `npm run typecheck` · `npm run build` · `npm run sim:bot` · `npm run dev:api` (local leaderboard on :8788, after a build)

## What's in here
| Path | What |
|---|---|
| `src/sim/` | Pure, deterministic game simulation and its tests |
| `src/app/` | Browser renderer, input, effects, sound, daily seed, share text, leaderboard client |
| `worker/`, `functions/` | Leaderboard API (Pages Functions) and the D1 schema |
| `docs/SPEC.md` | Game rules and numbers |
| `docs/ARCHITECTURE.md` | Code layout, determinism rules, leaderboard API |
| `docs/PLAN.md` | The weekend plan, milestone by milestone |
| `docs/COPY.md` | All the in-game jokes and text |
| `CLAUDE.md`, `claude-setup/` | How Claude Code was set up to build it: the `/milestone` skill, subagents and hooks |
