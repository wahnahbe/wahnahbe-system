# Purpose Pass v1.1 — Design Spec

**Date:** 2026-07-12
**Status:** Approved in brainstorm
**Principle:** every on-screen element is an output of real behavior — nothing decorative, nothing manually declared.

## 1. Delete HP/MP

- Remove from `web/src/components/StatusPanel.jsx`: both `GaugeRow`s, the `GaugeRow` component, `gaugePctFromClick`, the `[SYS] CLICK GAUGE TO SET` hint, and the `onGauge` prop (App wiring included).
- Remove `POST /api/health/gauge` from `server/routes/stateRoutes.js` and its tests.
- Health schema (`server/state/schemas.js`) drops `hp`/`mp`; `DEFAULTS.health` likewise. No migration for the live `health.json` — zod strips unknown keys on read, and the next write drops them permanently. Weigh-ins untouched.
- Update contracts: `CLAUDE.md` health shape; spec docs stay historical.

## 2. MEM://MASTERY block (replaces gauges at top of SYS://STATUS)

- **Parser:** `parseConceptMastery(md, weakestN = 3)` extends its return to `{ bands, total, weakest: [{name, score, band, lastSeen}] }` — the N lowest-scoring rows, ascending. Backward-compatible (existing fields unchanged); fixture test extended. Parse failure degrades the block (`[SYS] DATA LINK LOST — CONCEPT MASTERY`) without touching the rest of the panel.
- **UI (`MasteryBlock` in StatusPanel):**
  - Header `MEM://MASTERY` (jp 記憶 when jpLabels on).
  - One stacked proportional bar: solid (cyan) · forming (magenta) · shaky (dim), with `SOLID n · FORMING n · SHAKY n` counts beneath.
  - `REVIEW QUEUE:` the 3 weakest concepts as `NAME · score` lines, dim, truncated with ellipsis; a concept whose `lastSeen` is >30 days old gets a `STALE` tag.
- Data already flows as `tutor.mastery` — no new fetch.

## 3. Per-stat XP mileage

- **Server:** dashboard route adds `xp.byStat` — ledger entries reduced to `{[stat]: totalAmount}` (all 8 stats + GENERAL; absent stats omitted). Pure addition to the payload.
- **UI:** each StatusPanel stat row's right cell shows the mastery average (unchanged) with a small dim `+{n}xp` mileage figure beneath it when `byStat[stat] > 0`. GENERAL mileage renders as one footer line under the stat list: `GENERAL MILEAGE · +{n} XP`.
- Quest chips and add-quest stat selects unchanged — they now visibly move these numbers.

## Testing

- Parser: weakest-N extraction (ordering, tie behavior = document order, N > rows available).
- Route: `xp.byStat` sums and omits; gauge route returns 404 after removal.
- Web: MasteryBlock renders bands + queue + degrades; stat row shows mileage; gauge tests deleted.
- Suites + e2e green; e2e never referenced gauges.

## Rollout

Same-repo commits (public GitHub is now the remote); rebuild + restart via the system-restart flow after merge.
