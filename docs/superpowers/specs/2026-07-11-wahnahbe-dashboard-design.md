# Wahnahbe System — Life Dashboard Design Spec

**Date:** 2026-07-11
**Status:** Approved pending user review
**Design source:** Claude Design project "The Wahnahbe System" — `Wahnahbe System v2.dc.html` (project `5534726b-f1cc-4f5e-9d14-636dfdfce9b2`)

## 1. Purpose

A Solo Leveling-style "life RPG" dashboard that runs continuously on Josh's PC and holds his whole life: learning progress, quests, health, agenda, and Japanese study. It is fed by — and feeds back into — his second-brain Obsidian vault, so that learning done with Claude in any session shows up on the dashboard automatically.

Core principle: **files are the API.** The dashboard reads and writes plain files in the vault. Any Claude session (tutoring in the vault, coding elsewhere) updates the dashboard just by editing files. No cloud services, no databases, no auth.

## 2. Architecture

- **Frontend:** React + Vite SPA — a faithful port of the Wahnahbe System v2 design (purple/cyan neon HUD, Rajdhani / Share Tech Mono / Noto Sans JP fonts, scanlines, clip-path panels).
- **Server:** Node + Express, the only component that touches disk. Responsibilities:
  - Parse vault sources into a clean JSON API.
  - Watch vault files (chokidar) and push changes to the browser via SSE.
  - Handle writes (quests, weigh-ins, agenda, XP awards, settings) atomically.
  - Serve the production frontend build.
- **One process:** production mode is a single Node process serving static build + API + SSE on **`http://localhost:4777`**. Dev mode: Vite dev server proxying to the API.
- **Project location:** `C:\Users\gjgut\codingprojects\THESYSTEM`.

### Repo layout

```
THESYSTEM/
  server/          # Express app: routes, parsers, watcher, atomic file IO
    parsers/       # one module per vault source (report-card, gradebook, jp-progress, log)
    routes/        # API endpoints per domain (status, quests, agenda, skills, settings)
    state/         # read/write layer for second-brain/system/*.json (schema-validated)
  web/             # React app
    src/components/  # one folder per panel (Header, Agenda, Status, Quests, Skills, overlays)
    src/hooks/       # SSE subscription, API client
  docs/superpowers/specs/
  .claude/skills/  # sync-calendar, award, system-restart
  scripts/         # build + Task Scheduler install scripts
```

Files stay small (200–400 lines typical), organized by feature. Immutable update patterns throughout; no in-place mutation.

## 3. Data sources

### 3.1 Read-only vault sources (parsed, never written by the server)

| Source | Path | Feeds |
|---|---|---|
| Learning report card | `C:\Users\gjgut\second-brain\wiki\syntheses\learning-report-card.md` | 8-stat octagon averages (1–5), cumulative learning XP, level + level name, recent entries |
| Gradebook | `C:\Users\gjgut\second-brain\tutor\gradebook.md` | recent session grades |
| Concept mastery | `C:\Users\gjgut\second-brain\tutor\concept-mastery.md` | counts per mastery band |
| Wiki log | `C:\Users\gjgut\second-brain\wiki\log.md` | recent-activity feed (latest N entries, title line only) |
| Japanese progress | `C:\Users\gjgut\japanesetutor\progress.md` | LANG card: `current_level`, `streak`, `rolling_comp`, `last_session` (YAML frontmatter) |

Parsers are tested against snapshots of the real files. A parse failure degrades the affected panel to a `[SYS] DATA LINK LOST — <source>` state; it never crashes the dashboard or blocks other panels.

### 3.2 Dashboard-owned state — `C:\Users\gjgut\second-brain\system\` (new folder)

Lives inside the vault so it syncs with the brain and any Claude session can edit it.

| File | Contents |
|---|---|
| `quests.json` | daily quest definitions (title, XP, stat tag) + per-day completion state; side quests; main quests (title, desc, deadline, pct) |
| `health.json` | HP/MP current values; weigh-in log — seeded with baseline **200.0 lbs @ 2026-04-01** |
| `agenda.json` | events: `{date, time, title, type, source: "manual" \| "gcal", gcalId?}` |
| `xpLedger.json` | append-only: `{ts, amount, stat, reason, source}` for every dashboard/Claude XP award |
| `settings.json` | operative title, toggles (scanlines, JP labels, reduced motion), daily-quest config |

All writes: validate against schema → write temp file → rename (atomic). External edits to these files (e.g. by a Claude session) are picked up by the watcher and pushed live to the UI.

## 4. XP, levels, and stats

- **Total XP = report-card cumulative XP (parsed) + Σ xpLedger.json.** Tutoring sessions raise the first term via the existing vault protocol (unchanged); dashboard quests/training raise the second.
- **Level thresholds and level names are copied from the report card's level system** so the header always agrees with the vault (currently 249 XP, Level 4 — ENGINEER). The vault is authoritative for its own term: the server never writes learning XP, and if the report card's level table changes, the dashboard's thresholds follow it.
- **Radar = the 8 vault stats** (Conceptual, Mathematical, Statistical & Data Reasoning, Programming & Implementation, Software Eng. & Systems, Applied Problem-Solving, Communication & Translation, Retention & Connections), plotted as mastery 1–5 from the report card. Untested stats (`—`) render at center with a distinct marker.
- Quest/training XP awards are tagged with one of the 8 stats (or `GENERAL`) for future per-stat mileage display; v1 shows tags on quest chips but only the octagon uses mastery data.
- **Level-up:** when total XP crosses a threshold, the ASCENSION overlay fires once (crossings recorded in `xpLedger.json` to prevent re-fires).
- **Momentum ring** (header) = % of daily quests completed over the trailing 7 days.

## 5. UI (port of Wahnahbe System v2)

- **Boot sequence** on load (skippable), scanline overlay toggle, reduced-motion mode (kills all animation).
- **Header ticker:** WAHNAHBE wordmark, operative title (editable in settings), Level + XP bar (unified pool), date/time, momentum ring, SYS://CONFIG + reduced-motion buttons.
- **Agenda strip (OPS://TODAY):** today's events as chips (manual + calendar-synced), quick-add (date/time/title/type: SCHOOL, INTERVIEW, WORK, TRAINING, OTHER), delete, "+N upcoming" count, date picker.
- **Left — SYS://STATUS:** HP/MP click-to-set gauges (physical/focus); stat summary list (8 stats with mastery bars + status band); weigh-in log with sparkline, delta from baseline, input + LOG button.
- **Center — QST://QUESTS:** dailies (reset 00:00 local, EXECUTE button awards XP, config in settings); side quests (title + stat tag + XP tier 10/25/50, checkbox completes and awards); main quests (long-arc goals with deadline + progress slider).
- **Right — SKL://SKILLS:** octagon radar (8 stats); training logger (pick stat, S/M/L = +10/+20/+40 XP); **LANG card** — Japanese level, streak, rolling comprehension average, last session date, staleness hint; **recent-learning feed** — latest wiki log entry titles + latest gradebook grades.
- **Overlays:** NOTIFICATION popup (XP awards, quest completions), ASCENSION level-up overlay, settings drawer (edit title, daily quest definitions, weigh-in entries; export/import full state JSON; toggles).

Panel-level empty/error states use in-theme `[SYS]` lines. The design file is the visual source of truth; markup translates to JSX components with the same inline aesthetic converted to co-located styles.

## 6. Claude integration

- **Tutoring flow: zero changes.** Vault sessions already update the report card, gradebook, concept mastery, and logs; the watcher reflects them on the dashboard within seconds.
- **Skills in THESYSTEM (`.claude/skills/`):**
  - `/sync-calendar` — reads the next 7 days from Google Calendar (via the connected Calendar MCP) and merges into `agenda.json` (match on `gcalId`; never duplicates; manual events untouched). Run on request; optionally scheduled later.
  - `/award` — append an XP event to `xpLedger.json` from any conversation ("award 20 XP to Programming — built the file watcher").
  - `/system-restart` — rebuild frontend (`npm run build`) and bounce the Task Scheduler service; used after code changes.
- **CLAUDE.md** in THESYSTEM documents the file contracts so future sessions can edit state files directly and safely.

## 7. Auto-start on boot

- **Windows Task Scheduler** task, run-at-logon, hidden window: starts the production server (`node server/index.js`) on `localhost:4777` with restart-on-failure enabled.
- Server logs to `THESYSTEM/logs/server.log` (rotated, size-capped).
- Installed/updated by `scripts/install-autostart.ps1`; `/system-restart` handles rebuild + bounce after code changes.
- Accepted trade-offs (reviewed with user): silent boot failures mitigated by log + auto-restart; stale code after edits mitigated by `/system-restart`; ~60–100 MB RAM for an always-on Node process; localhost-only, no network exposure.

## 8. Error handling

- Every vault parse guarded; malformed table/frontmatter → panel degraded state + server log entry, other panels unaffected.
- Every state write schema-validated (fail fast, descriptive error to UI notification); atomic temp+rename; ledger is append-only.
- API errors return the standard envelope `{ok, data, error}`; UI surfaces failures as in-theme notifications, never silent.
- Watcher debounced to handle rapid successive writes (e.g. a Claude session editing multiple files).

## 9. Testing (80% coverage target)

1. **Unit:** parsers (against real-file snapshots + malformed variants), XP/level math (threshold crossings, report-card override), quest daily-reset logic, momentum calculation, atomic write layer.
2. **Integration:** API routes against a temp fixture vault (read state, complete quest, award XP, agenda merge including gcal dedup).
3. **E2E (smoke):** boot → dashboard renders with fixture data; complete a daily → XP bar and notification update; edit a vault file on disk → panel live-updates via SSE.

TDD workflow per global rules: tests first, then implementation.

## 10. Out of scope (v1)

- Job-search panel (vault `job searcher/` folder) — candidate v2 panel or MAIN quest source.
- LeetCode / CODING-PROGRESS panel.
- Scheduled/automatic calendar sync (v1 is on-request via `/sync-calendar`).
- Mobile layout; the design targets a desktop viewport.
- Writing to the report card from the dashboard (vault stays authoritative for learning XP).
