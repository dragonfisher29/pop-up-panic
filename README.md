# Pop-Up Panic

> Close the pop-ups before PanicOS 97 runs out of memory.

A single-player arcade game in the browser about a cursed 90s desktop. There's a new daily seed every day and a global leaderboard.
It's built in one weekend with Claude Code.

## Start here (Windows, PowerShell)
```powershell
cd C:\Users\nadth\Documents\FUN\pop-up-panic
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
powershell -ExecutionPolicy Bypass -File scripts\install-skills.ps1   # optional game-dev skills
npm run dev
```
Then start Claude Code in this folder and run the milestones in order:
```
claude
/milestone M0
```
Use `/clear` between milestones, and play the game during usage cooldowns.

## What's in here
| Path | What |
|---|---|
| `docs/PLAN.md` | **The weekend plan:** milestones M0–M6, schedule, cut order |
| `docs/SPEC.md` | Game rules and numbers (owner-only) |
| `docs/ARCHITECTURE.md` | Code layout, determinism rules, leaderboard API |
| `docs/COPY.md` | All the in-game jokes and text |
| `docs/PLAYTEST.md` | Your playtest log; Claude reads it each milestone |
| `docs/OWNER-TODO.md` | Things only you can do (accounts, logins, testers) |
| `CLAUDE.md` | Instructions Claude Code loads in every session |
| `claude-setup/` | Claude Code config: the `/milestone` skill, 3 subagents (test-runner, sim-guardian, milestone-reviewer), permissions and hooks. `setup.ps1` asks before copying it into `.claude/` |
| `src/sim/` | Pure, deterministic game simulation and tests (M0 starter: ads, RAM, hang fuse, combo) |
| `src/app/` | Browser renderer and loop (M0 placeholder) |
| `worker/schema.sql` | Leaderboard database schema (used in M5) |

## Commands
`npm run dev` · `npm test` · `npm run test:sim` · `npm run typecheck` · `npm run build`
