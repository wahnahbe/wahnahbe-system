# WAHNAHBE SYSTEM

A Solo Leveling-style life-RPG dashboard that runs permanently on my machine and holds my whole life: learning progress, quests, health, agenda, and Japanese study — fed live by my second-brain Obsidian vault, with an uncapped rank ladder that unlocks premium visual effects as I level.

![Wahnahbe System dashboard at MONARCH ★3](docs/media/dashboard.webp)

## The idea: files are the API

There is no database, no cloud, no auth. The dashboard is a local Express server + React SPA whose entire state is **plain files**:

- **Read-only vault sources** — my learning report card, tutoring gradebook, concept-mastery tracker, wiki activity log, and Japanese `progress.md` are markdown files maintained by Claude tutoring sessions. The server parses them live into an 8-stat mastery octagon, cumulative XP + level, a review queue, and activity feeds.
- **Dashboard-owned state** — quests, health, agenda, XP ledger, and settings live as schema-validated JSON inside the vault. Any Claude Code session (or any editor) can update the dashboard just by editing a file.

A chokidar watcher pushes every file change to the browser over SSE, so the dashboard reflects a finished tutoring session — or a hand-edited JSON file — within about a second.

## What it does

| | |
|---|---|
| **XP & levels — uncapped** | One unified pool: report-card XP (parsed from the vault) + an append-only XP ledger. Named ranks climb Apprentice → Engineer → Forward-Deployed Master → Architect → Netrunner → Ghost → Sovereign → **Monarch** (1,650 XP), then procedural ★ tiers forever, each 28% wider than the last. |
| **Rank identity** | Each rank carries an SVG insignia beside the level number and shifts the header's accent — violet at 6–7, spectral white at 8, gold at 9, white-gold at Monarch+. |
| **Rank FX unlocks** | Every rank permanently unlocks a page-level effect (see below) — lazy-loaded only when earned, paused on hidden tabs, all killed by reduced-motion or one settings toggle. |
| **Ascension ceremony** | Crossing a threshold fires a GSAP master timeline: the rank name scramble-decodes, the insignia draws itself stroke-by-stroke, and a shockwave + particle burst settles into `LEVEL UP — {RANK}`. Exactly once per crossing, recorded in the append-only ledger. |
| **8-stat octagon** | The radar plots real mastery scores (1–5) from graded tutoring sessions — not self-reported numbers. |
| **MEM://MASTERY** | Solid/forming/shaky concept bands as a stacked meter plus a review queue of my three weakest concepts, straight from the vault — with STALE tags when a concept hasn't been touched in 30 days. |
| **Quests** | Dailies (midnight reset), one-off side quests (+10/25/50 XP), and long-arc main quests with progress sliders. Every award is stat-tagged and rolls up into per-stat mileage next to the octagon's mastery averages. |
| **Health & agenda** | Weigh-in log with sparkline + delta from baseline; quick-add agenda with Google Calendar sync (via a Claude skill that merges by `gcalId`, never touching manual entries). |
| **Japanese** | Level, streak, and rolling comprehension parsed from the tutoring vault's frontmatter, with a staleness nudge after 14 idle days. |

## The rank FX ladder

| Lv | Rank | Unlock | Technique |
|---|---|---|---|
| 2 | Practitioner | Panel focus glow | GSAP micro-tweens |
| 3 | Analyst | XP bar energy current | masked gradient sweep |
| 4 | Engineer | Momentum ring draw-in | DrawSVG |
| 5 | FD Master | Terminal scramble-decode on titles | ScrambleText |
| 6 | Architect | Staggered boot cascade | GSAP master timeline |
| 7 | Netrunner | Katakana data rain backdrop | pooled canvas, tab-aware |
| 8 | Ghost | Organic turbulence displacement | SVG feTurbulence + feDisplacementMap |
| 9 | Sovereign | Gilded light sweep across the header | measured px tween, blend-mode screen |
| 10 | Monarch | FBM aurora shader behind all panels | OGL WebGL fragment shader, half-res; ★ tiers deepen it |

![Ascension ceremony — LEVEL UP](docs/media/ascension.webp)

## Architecture

```
second-brain vault (markdown + JSON)          THESYSTEM
┌─────────────────────────────────┐   ┌─────────────────────────────┐
│ report card / gradebook / logs  │──▶│ parsers (read-only)         │
│ concept mastery / jp progress   │   │                             │
│                                 │   │ Express API  ──▶  React SPA │
│ system/*.json (dashboard state) │◀─▶│ zod + atomic writes         │
└─────────────────────────────────┘   │ chokidar ──▶ SSE live push  │
                                      │ rank fx: GSAP + OGL, gated  │
                                      └─────────────────────────────┘
```

- **Server** (`server/`) — Express 4, the only component that touches disk. A single `thresholdFor(level)` generator drives both level math and ascension detection, so they can never disagree. Vault sources degrade per-source (`[SYS] DATA LINK LOST`) instead of crashing the endpoint; state writes are zod-validated then written atomically (temp + rename). The XP ledger is append-only and `awardXp` is its sole writer — completions award XP *before* persisting quest state, so a failed write can never strand a completed quest with no XP.
- **Web** (`web/`) — React 18 + Vite. A faithful port of a Claude Design HUD mock: clip-path panels, scanlines, boot sequence, Rajdhani/Share Tech Mono type. FX modules live in `web/src/fx/*` behind a gated lazy-loading hook (`useRankFx`) — no shader bytes ship to a level-2 player, and every module restores the DOM it touched on unmount (named `clearProps` only; GSAP never wrestles React for style ownership).
- **Deployment** (`scripts/`) — a Windows Task Scheduler task launches the production server hidden at logon. The launcher is synchronous, so the task instance lives and dies with the node process, and a 5-minute watchdog trigger restarts it unattended after a crash — measured recovery: 53 seconds. Binds `127.0.0.1` only.
- **Claude integration** (`.claude/skills/`) — skills for calendar sync, banking XP from any conversation, and rebuild-and-restart. `CLAUDE.md` documents the file contracts so any session can edit state safely.

## Testing

107 tests: parser units against real-format fixtures (including malformed variants), XP-engine boundary math across the procedural ladder (559/560, 2099/2100 ★2), FX gating with stale-async race coverage, supertest API integration on a fixture vault, and a Playwright E2E that boots a sandboxed production server, completes a quest, and proves the SSE live-update loop by editing a vault file on disk mid-test. Visual tiers verified by staged browser smoke at levels 5, 8, and 12.

```bash
npm test      # server + web suites
npm run e2e   # playwright smoke on an isolated fixture vault (run from a worktree — dist is live-served)
```

## Running it

Built for my machine, but the paths are env-driven:

```bash
npm install
npm run build
WAHNAHBE_VAULT=/path/to/vault WAHNAHBE_JP_VAULT=/path/to/jp npm start   # http://localhost:4777
```

Dev mode: `npm run dev` (server) + `npm run dev --workspace=web` (Vite on :5173, proxied).

## Provenance

Spec-first build across three shipped iterations — [v1 dashboard](docs/superpowers/specs/2026-07-11-wahnahbe-dashboard-design.md), [purpose pass](docs/superpowers/specs/2026-07-12-purpose-pass-design.md) (every element must earn its place: HP/MP deleted, mastery surfaced, mileage wired), and [uncapped levels + rank FX](docs/superpowers/specs/2026-07-13-uncapped-levels-rank-fx-design.md) — each executed as a TDD plan with a fresh implementation agent per task and independent review gates that caught real bugs before deploy (a level-math crash, an XP-eating write order, a layout-wiping `clearProps:'all'`, a LAN-exposed bind). The visual source of truth is [the original design mock](docs/design/wahnahbe-v2.dc.html).

*Screenshots show staged demo data (the hero is MONARCH ★3 at a simulated 2,749 XP).*
