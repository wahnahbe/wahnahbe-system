# THESYSTEM — Wahnahbe Dashboard

Life-RPG dashboard on http://localhost:4777 (auto-starts at logon via Task Scheduler task "WahnahbeSystem").
Spec: docs/superpowers/specs/2026-07-11-wahnahbe-dashboard-design.md. Visual reference: docs/design/wahnahbe-v2.dc.html.

## Golden rules
- Files are the API. Dashboard state lives in `C:\Users\gjgut\second-brain\system\*.json` — any session may edit those (atomically, schema-shapes below). The dashboard live-reloads via file watcher.
- NEVER write to the vault's learning files (report card, gradebook, concept-mastery, wiki log, JP progress.md) on behalf of the dashboard — the vault owns those; the dashboard only reads them.
- Total XP = report-card XP + xpLedger sum. Ledger entries are append-only.
- API award envelope: award-producing endpoints return `data.award` (with `amount`); the UI's notifications depend on it.
- After changing dashboard code: use the system-restart skill (rebuild + bounce).

## State file shapes (second-brain/system/)
- quests.json: {dailies:[{id,title,xp,stat}], completions:{"YYYY-MM-DD":[ids]}, sides:[{id,title,xp,stat,done,createdAt}], mains:[{id,title,desc,deadline,pct}]}
- health.json: {baseline:{date,lbs},weighIns:[{date,lbs}]}
- agenda.json: {events:[{id,date,time,title,type,source,gcalId?}]} — types SCHOOL|INTERVIEW|WORK|TRAINING|OTHER; source manual|gcal
- xpLedger.json: {entries:[{ts,amount,stat,reason,source}], crossings:[{level,ts}]}
- settings.json: {title,scanlines,jpLabels,reducedMotion}
- `stat` values: the 8 report-card stat names verbatim, or GENERAL.

## Dev
- `npm run dev` (server, :4777) + `npm run dev --workspace=web` (Vite, :5173). Tests: `npm test`. E2E: `npm run e2e`.
- `npm run e2e` rebuilds `web/dist`, which the LIVE server serves per-request — run e2e from an isolated git worktree (or stop the WahnahbeSystem task first) to avoid live-serving an unreviewed build.
