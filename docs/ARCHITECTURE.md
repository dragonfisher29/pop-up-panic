# Pop-Up Panic — Architecture

## 1. Layout
```
index.html               Vite entry
src/
  sim/                   PURE game simulation (no DOM, no time, no Math.random)
    constants.ts         every tuning number
    rng.ts               mulberry32 + FNV-1a seed hashing
    types.ts             GameState, Win, Input, PopupKind
    step.ts              createGame(seed), step(state, inputs) -> state
    kinds/               (M2) one behaviour module per PopupKind
    *.test.ts            Vitest
  app/                   browser side: renderer, input, audio, storage, UI screens
    main.ts              boot + fixed-timestep loop
    render.ts            (M1) keyed DOM renderer for windows + HUD
    input.ts             (M1) pointer/keyboard -> Input[] per tick
    audio.ts             (M3) WebAudio synth
    storage.ts           (M4) localStorage wrapper (try/catch everywhere)
    styles.css
worker/                  (M5) Cloudflare Worker + D1 leaderboard
  schema.sql
scripts/
  setup.ps1              Windows setup
  sim-bot.ts             (M2) balance bot
```

## 2. Determinism rules (enforced by the `sim-guardian` agent)
1. `src/sim/**` must never import from `src/app`, use `Math.random`, `Date`, `performance`, `window` or `document`, or do any async work.
2. Only integer arithmetic for state that affects gameplay: positions in px, RAM in milli-percent, time in ticks. If a division is needed, use `Math.floor` or `Math.trunc` on the result immediately.
3. All randomness comes from `state.rng` through `rngNext`, and the new rng state is written back into the state.
4. `step` is a pure function. It must not mutate its input; it returns a new state, sharing unchanged sub-objects is fine.
5. Iteration order is deterministic: arrays only, sorted by `id` where order matters. No relying on `Object.keys` ordering of numeric-like keys.
6. Same seed + same input log ⇒ byte-identical `JSON.stringify(state)`. This is tested.

## 3. Simulation contract
```ts
createGame(seed: number, opts?: { mode: 'daily' | 'endless' }): GameState
step(state: GameState, inputs: readonly Input[]): GameState   // advances exactly 1 tick
```
- Inputs for a tick are applied **before** spawning and leaking.
- Once `state.status === 'crashed'`, `step` returns the same state unchanged.
- Derived helpers such as `survivalMs(state)` and `ramPercent(state)` are pure functions in `step.ts` (or `selectors.ts` once it grows).

### Input (grows in M1/M2)
```ts
type Input =
  | { t: 'pointer'; x: number; y: number }          // virtual coords, once per tick when moved
  | { t: 'click'; id: number; part: WindowPart }     // part: 'close' | 'body' | 'link' | 'cancel' | 'tray'
  | { t: 'focus'; id: number }
  | { t: 'drag'; id: number; dx: number; dy: number }
  | { t: 'forceQuit'; x: number; y: number }
  | { t: 'taskManager' }
```
The M0 starter only has `{ t: 'close', id }`. In M1 this becomes `click` with `part: 'close'`.

## 4. App loop
- A fixed-timestep accumulator with `requestAnimationFrame`: `acc += dt; while (acc >= 1000/60) { state = step(state, drainInputs()); acc -= 1000/60 }`. At most 5 steps per frame, so a background tab doesn't spiral.
- The renderer draws from `state` after the steps run. It never writes back into the sim.
- Every tick's inputs are appended to `inputLog` as `[tick, ...input]` so the run can be replayed and submitted.
- Pausing on tab blur is fine for Endless mode, but Daily mode keeps running so it can't be exploited.

## 5. Rendering
- One `<div class="desktop">` sized 1280×720, scaled with `transform: scale(s)` and centred in the viewport.
- Windows are keyed by `id`: create on first sight, update `left/top/z-index` each frame, remove when gone. No framework.
- Visual-only state (pop-in animation, puffs, trail) lives in the app layer, never in the sim.

## 6. Leaderboard API (M5)
### 6.1 Endpoints
`POST /api/score`
```json
{ "day": "2026-11-15", "initials": "NAD", "timeMs": 94133, "points": 412, "closes": 87, "inputLog": [[0,"pointer",640,360], ...] }
```
→ `201 { "rank": 17 }`, or `400 { "error": "..." }`, or `429` when rate limited.

`GET /api/scores?day=2026-11-15&me=NAD` → `{ "top": [{ "rank":1, "initials":"AAA", "timeMs":201000, "points":900 }], "me": { "rank": 17, ... } | null }`

### 6.2 Validation (weekend version)
- `day` is today or yesterday (UTC).
- `initials` matches `^[A-Z]{3}$` and isn't on the blocklist.
- `0 < timeMs <= 600000`. The last tick in `inputLog` must be at least `timeMs / (1000/60) - 2`.
- `closes <= inputLog.length` and `points <= closes * 8`.
- `inputLog` is at most 200 KB once encoded.
- Rate limit: 5 submissions per `(day, ip_hash)`. `ip_hash = SHA-256(ip + daily salt)`; raw IPs are never stored.
- Keep only the best row per `(day, initials, ip_hash)`.
- **M5b:** replay `inputLog` with `src/sim` against `dailySeed(day)` and require the replayed `timeMs` and `points` to match exactly.

### 6.3 D1 schema
See `worker/schema.sql`.

## 7. Storage keys (localStorage, prefix `upp:`)
`upp:settings` (mute, volume, reducedMotion) · `upp:daily:<day>` (ranked result) · `upp:best:endless` · `upp:initials`
