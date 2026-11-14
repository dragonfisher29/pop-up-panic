# Pop-Up Panic — Playtest log

How it works: after each milestone, play the runs listed in PLAN.md and fill in a row. Claude Code reads this file at the start of the next milestone and turns problems into tasks.

## Checklist (every playtest)
- [ ] Does the game reach the crash screen without errors? (Open the browser devtools console.)
- [ ] Was any death unfair (couldn't see it coming)?
- [ ] Was anything confusing in the first 15 seconds?
- [ ] Did you want to press Retry right away?
- [ ] Desktop: is the window scaling right at 1366×768 and at 1920×1080?

## Log
| Date | Milestone | Tester | Mode/seed | Survived | What killed you | Unfair / confusing moments | Fun 1-5 |
|---|---|---|---|---|---|---|---|
| 14112026-0959| 1 | wuth | not sure | no | too many pop-ups | no | 4 |

## Balance targets (from SPEC §5)
- First-timer median death: **60–120 s**
- Practised player: **150–200 s**
- Balance bot median (`npm run sim:bot`): **90–140 s**
