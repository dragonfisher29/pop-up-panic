# Pop-Up Panic — Launch & Marketing Plan (DRAFT)

Status: draft, 2026-11-14. Budget assumed: $0, solo, ~1 hour a day for 2 weeks.
Live URL: https://pop-up-panic.pages.dev · Assets ready: `brag-output/` (16:9, square and vertical videos + stills), `public/og.png`, share text.

## Do first (today, ~45 min)
1. Record `docs/demo.gif` (README placeholder is still empty). ~10 min.
2. Turn on Cloudflare Web Analytics for the Pages project (free, no cookies, no banner needed). ~5 min.
3. Ship the SEO quick fixes below (robots.txt, sitemap, JSON-LD). ~20 min with Claude Code.
4. Post the vertical video + link to one channel (pick r/WebGames or Bluesky/X). ~10 min.

---

## 1. Positioning

- **One-liner:** Close the pop-ups before PanicOS 97 runs out of memory.
- **Hook:** a 90s desktop drowning in absurd pop-ups (hamster upgrades, free beans) — and the pop-ups fight back.
- **Why come back:** one ranked daily run, same seed for everyone, a global wall, and an emoji share strip (the Wordle loop).
- **Audiences, ranked:**
  1. Browser/casual game players (r/WebGames, itch.io, CrazyGames) — want a 2-minute fun thing.
  2. Daily-puzzle crowd (Wordle/Connections sharers) — want a daily ritual + bragging strip.
  3. Devs and AI-curious builders — want the "built in a weekend with Claude Code" + deterministic-sim story.
  4. 90s/Y2K nostalgia accounts — want the joke.
- **Pillars for every post:** funny (copy lines from `docs/COPY.md`), fair (300 ms tells), daily (come back tomorrow).

## 2. Channels

### Must (week 1)
| Channel | What to post | Asset | Time |
|---|---|---|---|
| Reddit r/WebGames, r/playmygame | "I made a game where the pop-ups fight back" + link | vertical mp4 or gif | 15 min each |
| itch.io | HTML5 page (embed or link out), tags: arcade, retro, parody, browser, daily | stills from `brag-output/screens` | 45 min once |
| Show HN | "Show HN: Pop-Up Panic – a daily browser game on a deterministic 60 Hz sim" — lead with tech | README tech notes | 20 min + 2 h replying |
| X / Bluesky / Threads | 3 posts across the week: video, a funny pop-up, your daily share strip | square mp4 | 10 min each |
| LinkedIn + portfolio | build story: weekend, milestones, AI-orchestrated workflow | 16:9 mp4 | 30 min |

### Later (week 2+)
- TikTok / YouTube Shorts / Reels: vertical clip, then "can you beat today's seed?" clips daily for a week.
- CrazyGames / Newgrounds / game portals: check each portal's submission rules first (some need their SDK, ads or a size limit).
- Discord: share in dev/game servers where self-promo channels exist. Do not drop links in general chat.
- r/ClaudeAI, r/webdev, dev.to: write-up of the build process (orchestrator + subagents, sim-guardian, TDD).
- Retro/nostalgia accounts and newsletters: DM a short pitch + gif.

### Rules for posting
- Read each subreddit's self-promo rule before posting; one post per sub, no cross-post spam.
- Post Tue–Thu morning US Eastern for Reddit/HN (tends to perform better; not guaranteed).
- Reply to every comment in the first 2 hours. That's where most of the reach comes from.
- Every link gets UTM tags, e.g. `?utm_source=reddit&utm_medium=social&utm_campaign=launch`.

## 3. SEO

The game is one page, so SEO is a small win. The real traffic is social + portals. Do the cheap fixes, skip the rest.

### Quick fixes (~20 min)
- [x] `<title>`, meta description, canonical, Open Graph, Twitter card — already in `index.html`.
- [x] Add `public/robots.txt` (allow all except `/api/`, points to sitemap).
- [x] Add `public/sitemap.xml` (one URL now; more if a how-to-play page is added).
- [x] Add JSON-LD `VideoGame` schema to `index.html`.
- [x] Visually-hidden "How to play" section (`#about`) in `index.html`, so crawlers and screen readers get real text.
- [x] Title tag now "Pop-Up Panic — a daily 90s pop-up browser game" (og/twitter titles unchanged).
- [ ] Deploy, then validate JSON-LD at https://search.google.com/test/rich-results.
- [ ] Submit the URL in Google Search Console and Bing Webmaster Tools.

### Keywords to aim for (low competition, long tail)
- "pop up game", "close the pop ups game", "90s desktop game", "retro browser game", "daily browser game", "free online arcade game no download".
- Use them naturally in the title tag (e.g. "Pop-Up Panic — a daily 90s pop-up browser game"), the description, and the itch.io page.

### Optional (only if traffic shows up)
- A static `/how-to-play` page using the README rules (one more indexable page).
- Backlinks come for free from itch.io, HN, portals and the portfolio. No paid link building.
- Custom domain (e.g. popuppanic.<tld>) — nicer to share; can be added later in Cloudflare without code changes.

## 4. Growth loop inside the game

Already built: daily seed, emoji share strip, leaderboard, "Next daily in" countdown.
Cheap improvements to consider (each is a small dev task, ~30–60 min):
1. Share text ends with the URL + day number ("Pop-Up Panic #12"), Wordle-style.
2. Add `?ref=share` to the shared link to measure the loop in analytics.
3. Streak counter (localStorage, try/catch) shown on the Run Report.
4. "Yesterday's champion" line on the menu to give people a reason to return.

These touch game code — run them as a milestone (`/milestone`), not ad hoc.

## 5. Two-week calendar

| Day | Action |
|---|---|
| D1 | Do-first list above. First Reddit post. |
| D2 | itch.io page live. X/Bluesky video post. |
| D3 | Show HN (morning US Eastern). Stay online to reply. |
| D4 | LinkedIn build story + portfolio entry. |
| D5 | Post your own daily share strip. Check analytics. |
| D6–7 | Rest. Fix anything players reported. |
| D8 | First vertical short on TikTok/Shorts/Reels. |
| D9 | Dev write-up (dev.to / r/ClaudeAI / r/webdev). |
| D10 | Submit to 1–2 game portals. |
| D11–13 | One short a day: "today's seed was brutal". |
| D14 | Review the numbers; decide continue / stop. |

## 6. Metrics (check D5 and D14)

| Metric | Where | D14 target (guess, adjust) |
|---|---|---|
| Unique visitors | Cloudflare Web Analytics | 1,000 |
| Daily runs submitted | D1 leaderboard table | 50/day by D14 |
| Return players (2+ days) | leaderboard initials/ids | 10% |
| Top referrer | Web Analytics | identify 1 channel to double down on |
| Share-link visits | `?ref=share` | > 0 means the loop works |

If one channel brings most traffic, put week-2 time there and drop the rest.

## 7. Risks
- Rude initials on the leaderboard after a spike — check the blocklist before the HN post.
- D1/Worker free-tier limits under a traffic spike — check Cloudflare limits before Show HN.
- Reddit removals for self-promo — read rules, post as a maker, ask for feedback.
- Branding: keep "PanicOS 97" original in all marketing; no Microsoft/Windows names or logos in posts or thumbnails.

## Open questions for the owner
1. Is there any budget (e.g. $20–50 for a domain or a boosted post)?
2. Main goal: players, portfolio/job visibility, or both? (Changes whether HN/LinkedIn or Reddit/TikTok come first.)
3. OK to show your name/face in videos and the build story?

---
Routing log: drafted directly by the orchestrator (Opus); no subagents — context was already loaded and the task was one document, so delegation would have cost more than it saved.
