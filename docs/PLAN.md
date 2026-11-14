# Pop-Up Panic — Weekend Build Plan

**Budget:** about 16 hours over Sat and Sun. **Claude plan:** Pro (5-hour windows plus a weekly cap, shared with claude.ai chat).
**Rules:** one milestone per Claude Code session, `/clear` between milestones, no parallel sessions, and playtest during usage cooldowns.
Run each milestone with `/milestone Mx`. Mark the status here when a milestone is reviewed and playtested.

| Milestone | Status | When | Est. |
|---|---|---|---|
| M0 Setup check | TODO | Sat 09:00 | 0.5 h |
| M1 Desktop | DONE | Sat 09:30 | 2.5 h |
| M2 Chaos | DONE | Sat 13:30 | 3 h |
| M3 Effects | DONE | Sat 17:30 | 2.5 h |
| M4 Daily | TODO | Sun 09:30 | 2 h |
| M5 Leaderboard and deploy | TODO | Sun 12:00 | 3 h |
| M6 Ship | TODO | Sun 16:00 | 2.5 h |
| Buffer / M5b replay check | — | Sun 19:00 | — |
| M7 Brag (launch video) | TODO | Sun 20:00, or Mon | 1 h |

**Skills per milestone** (installed by `scripts\install-skills.ps1`; Claude loads them when a task matches, and the milestone skill names them explicitly):
| Milestone | Skills |
|---|---|
| M1 | `game-development` (its web-games and 2d-games sub-skills), `frontend-design`, `webapp-testing` |
| M2 | `game-development`, `webapp-testing` |
| M3 | `frontend-design`, `webapp-testing` |
| M4 | `webapp-testing` |
| M5 | `wrangler`, `webapp-testing` |
| M6 | `webapp-testing` (desktop and mobile viewport screenshots) |
| M7 | `brag` (plugin) |

**Cut order if you fall behind:** stretch types → `toolbar` → Endless mode → M5b replay check → yesterday's board.
**Never cut:** the crash screen, share text, daily seed or sound. These are the wow and the reach.

---

## M0 — Setup check (starter repo already includes most of it)
**Goal:** the starter repo runs on your PC and is in a GitHub repo.
- [ ] `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` passes (Node, npm install, tests, typecheck).
- [ ] `npm run dev` shows the bare desktop, ads spawn, clicking X closes them, and the run crashes when RAM fills.
- [ ] Create a private GitHub repo `pop-up-panic` and push (`gh repo create pop-up-panic --private --source . --push`).
- [ ] Optional: inside Claude Code, run `/plugin install superpowers@claude-plugins-official` (for writing-plans).

**Done when:** tests are green, the dev server works and the first commit is pushed.

## M1 — Desktop (window manager)
**Goal:** a dull but complete run with a solid window system.
- Sim: focus and z-order inputs (`focus`), drag inputs (`drag` with integer dx/dy, clamped to the desktop), `windowsUnder(x, y)` helper.
- Renderer: real PanicOS window chrome (title bar, bevelled face, X button), keyed DOM diffing by window id, scaling 1280×720 to fit the viewport with letterboxing.
- Input capture: pointer events mapped to virtual coordinates and turned into `Input[]` per tick, with a pointer position sampled every tick (needed by the runner in M2).
- Taskbar HUD: Begin button (opens a fake menu with Mute and About), RAM bar with %, run clock.
- Hang fuse, a basic crash screen and a results panel showing time and closes, with a Retry button.
- Title screen: "Press any key to boot PanicOS 97" → a fake boot text crawl you can skip → run.
- Tests: z-order after focus, drag clamping, close frees RAM, hang fuse cancels when RAM drops below 100%.

**Playtest (owner):** play 3 runs. Is clicking X precise at small screen sizes? Does dragging feel right?

## M2 — Chaos (the actual game)
**Goal:** all 8 pop-up types, the spawn director and the panic tools. This is where the game becomes fun or doesn't.
- Sim: per-type behaviour modules in `src/sim/kinds/*.ts`, each with `spawn`, `onTick`, `onClose`, `onClick(part)`. Window parts: `close`, `body`, `link`, `cancel`, `tray`.
- Spawn director: easing interval, bursts, unlock waves and weighted picks exactly as in SPEC §5. All constants go in `constants.ts`.
- Toolbar strips shrink the desktop area; spawns and clamping use the available area.
- Antivirus behaviour and the closing penalty.
- Force Quit (charges and regen) and Task Manager (once per run).
- Telegraph flags in state (`tellUntilTick`) so the renderer can show wobble and flash.
- Combo and points.
- Tests: one test file per kind covering its twist and counter, director unlock timing, a determinism test for a 3-minute scripted run.
- **Balance bot:** `npm run sim:bot` plays 200 seeds with a simple "close the oldest window with the correct counter at 3 clicks/s" policy and prints median survival. Target: 90–140 s. Tune `constants.ts` until it lands there.

**Playtest (owner):** 5 runs, plus 1 friend who has never seen it. Write down death times and the moments that felt unfair in `docs/PLAYTEST.md`.

## M3 — Effects
**Goal:** it feels great with the sound on.
- `src/app/audio.ts`: synthesized sound effects (SPEC §10), mute saved in localStorage, starts on first click.
- Pop-in, close puff, combo popups ("×4!"), screen shake above 80%, red vignette and fuse countdown during a hang, cursor trail.
- Crash screen: CRT scanlines, falling chord, "A fatal exception 0xPANIC has occurred", then results counting up.
- Copy: wire in the `docs/COPY.md` text banks (picked by the seeded RNG so a daily run is identical for everyone).
- Reduced-motion support.
- Wave fanfare: "NEW THREAT DETECTED: Virus Scan".

**Playtest (owner):** headphones on, 3 runs. Is anything annoying in a bad way?

## M4 — Daily
**Goal:** a reason to come back tomorrow, and a reason to post about it.
- `dailySeed(dateUtc)` and `puzzleNumber(dateUtc)` (launch date in `constants.ts`).
- Mode select on the title screen: Daily (ranked, once per day) and Endless.
- localStorage: today's ranked result, best times, settings. Every read is wrapped in try/catch.
- Share text exactly as in SPEC §7, plus a "Copied!" toast. Use the Web Share API on mobile where it's available.
- Results screen: time, points, closes, best combo, RAM strip, share button, "Next daily in 07:12:33".
- Tests: seed is stable for a date, share text format, the RAM strip slices.

## M5 — Leaderboard and deploy
**Pre-flight (owner):** a Cloudflare account and `npx wrangler login` done. Hosting decision: by default use the free `*.pages.dev` URL. A custom domain can be added later without code changes.
- Add `wrangler` as a dev dependency. Write `worker/src/index.ts` as a Pages Functions-style Worker (or `functions/api/*` on Pages) with D1 bound as `DB`.
- `POST /api/score` and `GET /api/scores?day=` exactly as in ARCHITECTURE §6. Apply `worker/schema.sql` locally first, then remotely (the remote step asks for permission).
- Initials picker UI (3 arcade letter wheels, using keyboard arrows or taps) and the blocklist.
- Leaderboard panel on the results and title screens (today / yesterday), with your own row highlighted.
- Validation for the weekend: bounds checks (see ARCHITECTURE §6.2), rate limit and blocklist.
- Deploy: `npm run build` then `npx wrangler pages deploy dist` (asks for permission). Test from your phone.

**Done when:** a run from your phone appears on the live board.

## M5b — Replay check (stretch, Sunday buffer)
- The Worker imports `src/sim`, replays `inputLog` against the day's seed and rejects the run if its time or points don't match. Add a test that a tampered log is rejected.

## M6 — Ship
- Mobile pass: touch dodge circle for the runner, on-screen tool buttons, rotate hint, 44 px targets. Check on Android and iPhone.
- Open-graph image (a static 1200×630 PNG of a chaotic desktop, drawn in-game and captured), title, meta description, favicon.
- README with a GIF (record with ScreenToGif), how to play, and tech notes for your portfolio.
- Error guard: if the game throws, show a joke "Blue Screen of Panic" with a reload button instead of a dead page.
- Final `milestone-reviewer` pass over the whole game, then tag `v1.0`.

**Done when:** the public link works on desktop, Android and iPhone, and your share text pastes cleanly into WhatsApp and Discord.

## M7 — Brag (launch video)
**Goal:** a short, shareable launch video plus post copy, made with the `/brag` skill once v1.0 is live.
**Pre-flight (owner):** the brag plugin is installed (`/plugin marketplace add latent-spaces/brag`, then `/plugin install brag@brag`), and Claude Code has been restarted. Node 22+ and FFmpeg are on PATH. `npx hyperframes doctor` passes.
- Start a fresh session (`/clear`) in the repo root, after M6 is DONE and the live URL is in the README.
- Run: `/brag --tone "late-90s TV infomercial for PanicOS 97 — 'Are pop-ups ruining YOUR life?'"`
  - On Opus 5.5, `/brag` switches to the leaner `/brag-slim` automatically. Add `--full` for the full Hyperframes workflow with bundled music.
  - Narration is off by default. Add `--voice` if you want an infomercial-style voice-over.
- Give brag the material it needs: the live URL, the README GIF, 3–4 gameplay screenshots captured with `webapp-testing` (a calm desktop, a full desktop, a hang, the crash screen), and the share-text example from SPEC §7.
- Review what it produces in `brag-output/` (the plan, composition brief, share copy and `brag.mp4`). Ask for one round of changes at most.
- Commit the plan, brief and share copy. The mp4 is gitignored; upload it to wherever you post instead.

**Done when:** `brag-output/brag.mp4` plays, the share copy includes the live URL, and you've posted it.
