# Wahnahbe System Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local life-RPG dashboard (React + Express, `localhost:4777`) that renders the Wahnahbe System v2 design, live-reads Josh's second-brain vault (learning report card, gradebook, concept mastery, wiki log, Japanese progress), and stores its own state (quests, health, agenda, XP ledger, settings) as JSON files inside the vault so any Claude session can update it.

**Architecture:** One Express server is the only disk-toucher: it parses vault markdown into a JSON API, watches files with chokidar and pushes SSE refresh events, and applies atomic schema-validated writes to `second-brain/system/*.json`. A Vite/React SPA (faithful port of `docs/design/wahnahbe-v2.dc.html`) consumes the API. Total XP = report-card XP + XP-ledger sum; the radar is the vault's 8-stat mastery octagon.

**Tech Stack:** Node ≥ 20 (ESM), Express 4, chokidar 4, zod 3, gray-matter 4, Vitest + Supertest, React 18 + Vite 5, @playwright/test (E2E smoke).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-wahnahbe-dashboard-design.md`. Visual source of truth: `docs/design/wahnahbe-v2.dc.html` (already in repo).
- Server port: **4777**. Vite dev port 5173 proxying `/api` → 4777.
- Vault paths (env-overridable, defaults hardcoded): second-brain `C:\Users\gjgut\second-brain`, JP vault `C:\Users\gjgut\japanesetutor`, state dir `<second-brain>\system`.
- Server **never writes** to report card / gradebook / concept-mastery / logs / progress.md. It only writes `second-brain/system/*.json`.
- All state writes: zod-validate → write `<file>.tmp` → rename (atomic). `xpLedger.json` entries are append-only.
- API envelope: success `{ok: true, data}` / failure `{ok: false, error}`. Vault-source sections degrade per-source, never crash the endpoint.
- Immutability: never mutate loaded state objects in place — build new objects and write those.
- Level table (mirrors report card §Experience): 1 Apprentice 0–39 · 2 Practitioner 40–119 · 3 Analyst 120–239 · 4 Engineer 240–399 · 5 Forward-Deployed Master 400+.
- Weigh-in baseline seed: **200.0 lbs @ 2026-04-01**.
- Colors: bg `#08050F`, panel `rgba(22,12,40,0.72)`, magenta `#D24BFF`, cyan `#3FE8FF`, text `#F2EAFF`, deep `rgba(11,7,22,.9)`. Fonts: Rajdhani (display), Share Tech Mono (body), Noto Sans JP.
- Files 200–400 lines typical, 800 max. TDD: every task writes its failing test first. Commit after every task (conventional commits).
- Local dates use `localDateStr()` (`en-CA` = YYYY-MM-DD); daily quests key completions by that string, reset is implicit at midnight local.

---

### Task 1: Repo scaffold + server config

**Files:**
- Create: `package.json`, `.gitignore`, `server/package.json`, `server/vitest.config.js`, `server/config.js`
- Test: `server/test/config.test.js`

**Interfaces:**
- Produces: `config` object — `{ port: number, vaultDir: string, jpVaultDir: string, stateDir: string, logDir: string, sources: { reportCard, gradebook, conceptMastery, wikiLog, jpProgress } }` (all absolute paths). Every later server module imports `config` from `../config.js` or reads paths from an injected config (tests inject temp dirs).

- [ ] **Step 1: Write root and server package files + gitignore**

`package.json` (root):
```json
{
  "name": "thesystem",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "npm run dev --workspace=server",
    "build": "npm run build --workspace=web",
    "start": "npm run start --workspace=server",
    "test": "npm test --workspace=server && npm test --workspace=web"
  }
}
```

`.gitignore`:
```
node_modules/
web/dist/
logs/
*.log
test-results/
playwright-report/
```

`server/package.json`:
```json
{
  "name": "@thesystem/server",
  "type": "module",
  "scripts": {
    "dev": "node index.js",
    "start": "cross-env NODE_ENV=production node index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "chokidar": "^4.0.0",
    "cross-env": "^7.0.3",
    "express": "^4.19.0",
    "gray-matter": "^4.0.3",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

`server/vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
```

- [ ] **Step 2: Write the failing config test**

`server/test/config.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  it('uses defaults when no env overrides', () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(4777);
    expect(cfg.vaultDir).toBe('C:\\Users\\gjgut\\second-brain');
    expect(cfg.jpVaultDir).toBe('C:\\Users\\gjgut\\japanesetutor');
    expect(cfg.stateDir).toBe('C:\\Users\\gjgut\\second-brain\\system');
    expect(cfg.sources.reportCard).toContain('learning-report-card.md');
  });

  it('honors env overrides and derives stateDir from vaultDir', () => {
    const cfg = loadConfig({ WAHNAHBE_VAULT: 'D:\\vault', WAHNAHBE_PORT: '5000' });
    expect(cfg.port).toBe(5000);
    expect(cfg.stateDir).toBe('D:\\vault\\system');
    expect(cfg.sources.wikiLog).toBe('D:\\vault\\wiki\\log.md');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd C:\Users\gjgut\codingprojects\THESYSTEM && npm install && npx vitest run --root server`
Expected: FAIL — `Cannot find module '../config.js'`

- [ ] **Step 4: Implement `server/config.js`**

```js
import path from 'node:path';

export function loadConfig(env = process.env) {
  const vaultDir = env.WAHNAHBE_VAULT ?? 'C:\\Users\\gjgut\\second-brain';
  const jpVaultDir = env.WAHNAHBE_JP_VAULT ?? 'C:\\Users\\gjgut\\japanesetutor';
  const stateDir = env.WAHNAHBE_STATE_DIR ?? path.join(vaultDir, 'system');
  return {
    port: Number(env.WAHNAHBE_PORT ?? 4777),
    vaultDir,
    jpVaultDir,
    stateDir,
    logDir: env.WAHNAHBE_LOG_DIR ?? path.join(import.meta.dirname, '..', 'logs'),
    sources: {
      reportCard: path.join(vaultDir, 'wiki', 'syntheses', 'learning-report-card.md'),
      gradebook: path.join(vaultDir, 'tutor', 'gradebook.md'),
      conceptMastery: path.join(vaultDir, 'tutor', 'concept-mastery.md'),
      wikiLog: path.join(vaultDir, 'wiki', 'log.md'),
      jpProgress: path.join(jpVaultDir, 'progress.md'),
    },
  };
}

export const config = loadConfig();
```

- [ ] **Step 5: Run tests, verify pass, commit**

Run: `npx vitest run --root server` → PASS (2 tests).
```bash
git add package.json .gitignore server docs/design
git commit -m "feat: scaffold workspaces, server config, design reference"
```

---

### Task 2: Atomic state IO + zod schemas

**Files:**
- Create: `server/state/schemas.js`, `server/state/io.js`
- Test: `server/test/state-io.test.js`

**Interfaces:**
- Produces:
  - `schemas` — zod schemas keyed by state file stem: `quests`, `health`, `agenda`, `xpLedger`, `settings`.
  - `readStateFile(stateDir, name)` → parsed+validated object (returns validated defaults if file missing).
  - `writeStateFile(stateDir, name, data)` → validates, writes `<name>.json.tmp`, renames to `<name>.json`. Throws `Error('validation failed: …')` on bad data.
  - `DEFAULTS[name]` — the default object per file (health seeded with baseline weigh-in).

- [ ] **Step 1: Write the failing test**

`server/test/state-io.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readStateFile, writeStateFile, DEFAULTS } from '../state/io.js';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-')); });

describe('state io', () => {
  it('returns seeded defaults when file missing', () => {
    const health = readStateFile(dir, 'health');
    expect(health.hp).toBe(100);
    expect(health.weighIns[0]).toEqual({ date: '2026-04-01', lbs: 200.0 });
  });

  it('round-trips a valid write atomically (no tmp left behind)', () => {
    const next = { ...DEFAULTS.health, hp: 62 };
    writeStateFile(dir, 'health', next);
    expect(readStateFile(dir, 'health').hp).toBe(62);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects invalid data and leaves the old file intact', () => {
    writeStateFile(dir, 'health', DEFAULTS.health);
    expect(() => writeStateFile(dir, 'health', { hp: 'high' })).toThrow(/validation failed/);
    expect(readStateFile(dir, 'health').hp).toBe(100);
  });

  it('has schemas + defaults for all five state files', () => {
    for (const name of ['quests', 'health', 'agenda', 'xpLedger', 'settings']) {
      expect(readStateFile(dir, name)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root server state-io` → FAIL (module not found).

- [ ] **Step 3: Implement schemas**

`server/state/schemas.js`:
```js
import { z } from 'zod';

const STATS = ['Conceptual', 'Mathematical', 'Statistical & Data Reasoning',
  'Programming & Implementation', 'Software Eng. & Systems', 'Applied Problem-Solving',
  'Communication & Translation', 'Retention & Connections'];
export const StatTag = z.enum([...STATS, 'GENERAL']);
export const STAT_NAMES = STATS;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const schemas = {
  quests: z.object({
    dailies: z.array(z.object({
      id: z.string(), title: z.string().min(1), xp: z.number().int().positive(), stat: StatTag,
    })),
    completions: z.record(isoDate, z.array(z.string())), // date -> daily ids done that day
    sides: z.array(z.object({
      id: z.string(), title: z.string().min(1), xp: z.number().int().positive(),
      stat: StatTag, done: z.boolean(), createdAt: z.string(),
    })),
    mains: z.array(z.object({
      id: z.string(), title: z.string().min(1), desc: z.string(), deadline: isoDate.or(z.literal('')),
      pct: z.number().min(0).max(100),
    })),
  }),
  health: z.object({
    hp: z.number().min(0).max(100), mp: z.number().min(0).max(100),
    baseline: z.object({ date: isoDate, lbs: z.number().positive() }),
    weighIns: z.array(z.object({ date: isoDate, lbs: z.number().positive() })),
  }),
  agenda: z.object({
    events: z.array(z.object({
      id: z.string(), date: isoDate, time: z.string().regex(/^\d{2}:\d{2}$/),
      title: z.string().min(1),
      type: z.enum(['SCHOOL', 'INTERVIEW', 'WORK', 'TRAINING', 'OTHER']),
      source: z.enum(['manual', 'gcal']), gcalId: z.string().optional(),
    })),
  }),
  xpLedger: z.object({
    entries: z.array(z.object({
      ts: z.string(), amount: z.number().int(), stat: StatTag,
      reason: z.string(), source: z.string(),
    })),
    crossings: z.array(z.object({ level: z.number().int(), ts: z.string() })),
  }),
  settings: z.object({
    title: z.string(),
    scanlines: z.boolean(), jpLabels: z.boolean(), reducedMotion: z.boolean(),
  }),
};
```

- [ ] **Step 4: Implement IO**

`server/state/io.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { schemas } from './schemas.js';

export const DEFAULTS = {
  quests: {
    dailies: [
      { id: 'd-train', title: 'TRAINING SESSION', xp: 15, stat: 'GENERAL' },
      { id: 'd-study', title: 'STUDY BLOCK', xp: 15, stat: 'Conceptual' },
      { id: 'd-code', title: 'WRITE CODE', xp: 15, stat: 'Programming & Implementation' },
    ],
    completions: {}, sides: [], mains: [],
  },
  health: {
    hp: 100, mp: 100,
    baseline: { date: '2026-04-01', lbs: 200.0 },
    weighIns: [{ date: '2026-04-01', lbs: 200.0 }],
  },
  agenda: { events: [] },
  xpLedger: { entries: [], crossings: [] },
  settings: { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: false },
};

const fileOf = (dir, name) => path.join(dir, `${name}.json`);

export function readStateFile(stateDir, name) {
  const schema = schemas[name];
  if (!schema) throw new Error(`unknown state file: ${name}`);
  const file = fileOf(stateDir, name);
  if (!fs.existsSync(file)) return schema.parse(DEFAULTS[name]);
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed.success) throw new Error(`validation failed reading ${name}: ${parsed.error.message}`);
  return parsed.data;
}

export function writeStateFile(stateDir, name, data) {
  const schema = schemas[name];
  if (!schema) throw new Error(`unknown state file: ${name}`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`validation failed writing ${name}: ${parsed.error.message}`);
  fs.mkdirSync(stateDir, { recursive: true });
  const file = fileOf(stateDir, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(parsed.data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return parsed.data;
}
```

- [ ] **Step 5: Run tests → PASS. Commit**

```bash
git add server/state server/test/state-io.test.js
git commit -m "feat: atomic schema-validated state file IO with seeded defaults"
```

---

### Task 3: Report-card parser

**Files:**
- Create: `server/parsers/reportCard.js`, `server/test/fixtures/learning-report-card.md`
- Test: `server/test/report-card.test.js`

**Interfaces:**
- Produces: `parseReportCard(markdown)` → `{ stats: [{name, average: number|null, status}] (8 items, null = '—'), totalXp: number, level: number, levelName: string, sessionsGraded: number, entries: [{n, date, title, grade}] (newest first, max 5) }`. Throws on unrecognizable content (caller degrades).

- [ ] **Step 1: Create fixture** — copy the REAL sections verbatim from `C:\Users\gjgut\second-brain\wiki\syntheses\learning-report-card.md` into the fixture: the `| Stat | Average | Status |` table (lines ~80–89), the `## Experience` block, and two `### Entry N — …` headers. Fixture content:

```markdown
## Current skill octagon

| Stat | Average | Status |
|---|---|---|
| Conceptual | 4.1 | Strong |
| Mathematical | 3.0 | Developing |
| Statistical & Data Reasoning | 4.7 | **Mastery** |
| Programming & Implementation | 3.3 | Developing |
| Software Eng. & Systems | — | Not yet assessed |
| Applied Problem-Solving | 4.0 | Strong |
| Communication & Translation | 3.5 | Strong |
| Retention & Connections | 3.6 | Strong |

## Experience

- **Total XP:** 249
- **Level:** 4 — *Engineer* *(crossed 240 with Entry 13)*
- **Sessions graded:** 12

## Session & assignment log

### Entry 13 — 2026-07-10 — Fixed Effects (Causal Wk10) · *tutoring* · Grade: A− (thin coverage) — **and Tutor Grade: F**

body text

### Entry 12 — 2026-06-27 — Propensity Scores & IPW · *tutoring (Experimental Design & Causality Wk8 Topic 2)* · Grade: A−

body text
```

- [ ] **Step 2: Write the failing test**

`server/test/report-card.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseReportCard } from '../parsers/reportCard.js';

const md = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/learning-report-card.md'), 'utf8');

describe('parseReportCard', () => {
  it('parses the 8 stat averages, mapping — to null', () => {
    const r = parseReportCard(md);
    expect(r.stats).toHaveLength(8);
    expect(r.stats[0]).toEqual({ name: 'Conceptual', average: 4.1, status: 'Strong' });
    expect(r.stats.find((s) => s.name === 'Software Eng. & Systems').average).toBeNull();
    expect(r.stats.find((s) => s.name === 'Statistical & Data Reasoning').average).toBe(4.7);
  });

  it('parses XP, level, level name, sessions', () => {
    const r = parseReportCard(md);
    expect(r.totalXp).toBe(249);
    expect(r.level).toBe(4);
    expect(r.levelName).toBe('Engineer');
    expect(r.sessionsGraded).toBe(12);
  });

  it('parses recent entries newest-first', () => {
    const r = parseReportCard(md);
    expect(r.entries[0]).toEqual({ n: 13, date: '2026-07-10', title: 'Fixed Effects (Causal Wk10)', grade: 'A− (thin coverage)' });
    expect(r.entries[1].n).toBe(12);
  });

  it('throws on garbage input', () => {
    expect(() => parseReportCard('# nothing here')).toThrow();
  });
});
```

- [ ] **Step 3: Run test** → FAIL (module not found).

- [ ] **Step 4: Implement**

`server/parsers/reportCard.js`:
```js
const strip = (s) => s.replace(/\*/g, '').trim();

export function parseReportCard(md) {
  // Stat averages table: rows "| <name> | <avg or —> | <status> |" after the octagon header.
  const stats = [];
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([\d.]+|—)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
  const tableStart = md.indexOf('| Stat | Average | Status |');
  if (tableStart === -1) throw new Error('stat table not found');
  for (const m of md.slice(tableStart).matchAll(rowRe)) {
    if (m[1] === 'Stat' || /^-+$/.test(m[1])) continue;
    stats.push({ name: strip(m[1]), average: m[2] === '—' ? null : Number(m[2]), status: strip(m[3]) });
    if (stats.length === 8) break;
  }
  if (stats.length !== 8) throw new Error(`expected 8 stats, got ${stats.length}`);

  const xpM = md.match(/\*\*Total XP:\*\*\s*(\d+)/);
  const lvlM = md.match(/\*\*Level:\*\*\s*(\d+)\s*—\s*\*([^*]+)\*/);
  const sesM = md.match(/\*\*Sessions graded:\*\*\s*(\d+)/);
  if (!xpM || !lvlM) throw new Error('experience block not found');

  const entries = [...md.matchAll(
    /^### Entry (\d+) — (\d{4}-\d{2}-\d{2}) — (.+?) · \*[^*]*\* · Grade: ([^—\n]+?)(?:\s*—.*)?$/gm,
  )].map((m) => ({ n: Number(m[1]), date: m[2], title: strip(m[3]), grade: strip(m[4]) }))
    .sort((a, b) => b.n - a.n).slice(0, 5);

  return {
    stats,
    totalXp: Number(xpM[1]),
    level: Number(lvlM[1]),
    levelName: strip(lvlM[2]),
    sessionsGraded: sesM ? Number(sesM[1]) : 0,
    entries,
  };
}
```

- [ ] **Step 5: Run tests → PASS. Also sanity-check against the real file** (`node -e "import('./server/parsers/reportCard.js').then(async m=>console.log(m.parseReportCard(require('fs').readFileSync('C:/Users/gjgut/second-brain/wiki/syntheses/learning-report-card.md','utf8'))))"` — must print 8 stats and XP 249). Commit:

```bash
git add server/parsers/reportCard.js server/test
git commit -m "feat: learning report card parser (octagon, XP, level, entries)"
```

---

### Task 4: Secondary parsers — JP progress, wiki log, gradebook, concept mastery

**Files:**
- Create: `server/parsers/jpProgress.js`, `server/parsers/wikiLog.js`, `server/parsers/tutorFiles.js`
- Create fixtures: `server/test/fixtures/progress.md`, `server/test/fixtures/log.md`, `server/test/fixtures/gradebook.md`, `server/test/fixtures/concept-mastery.md`
- Test: `server/test/secondary-parsers.test.js`

**Interfaces:**
- `parseJpProgress(markdown)` → `{ level: string, streak: number, rollingComp: number[], rollingAvg: number, lastSession: string, paused: boolean, staleDays: (now) => number }` — actually return plain data: `{ level, streak, rollingComp, rollingAvg, lastSession, paused }`.
- `parseWikiLog(markdown, n=6)` → `[{ date, kind, title }]` newest-last-in-file → returned newest-first.
- `parseGradebook(markdown, n=5)` → `[{ date, concept, pct }]` newest-first (entries headed `### YYYY-MM-DD — <concept> · NN%`; headers without `· NN%` are skipped).
- `parseConceptMastery(markdown)` → `{ bands: { solid: number, forming: number, shaky: number }, total: number }`.

- [ ] **Step 1: Create fixtures** with real-format excerpts.

`fixtures/progress.md`:
```markdown
---
current_level: N5
last_session: 2026-06-11
streak: 14
rolling_comp: [1.0, 1.0, 1.0, 0.67, 0.83]
started: 2026-05-03
paused: false
---

# Progress
body
```

`fixtures/log.md`:
```markdown
## [2026-07-08] ingest | BU Experimental Design & Causality Week 9 (Simulation, Lessons 9.1–9.3 + Effect Ch. 15) → 16 pages touched. Body text continues here.

## [2026-07-10] ingest | BU Experimental Design & Causality Week 10, Lesson 10.1 (Fixed Effects + Effect Ch. 16) → 11 pages touched. Body.

## [2026-07-10] teach | Causal Wk10 fixed effects guided lesson → 6 pages touched · session completed. Body.
```

`fixtures/gradebook.md`:
```markdown
### 2026-06-24 — system initialized

Scoring system built.

### 2026-06-24 — Error term (regression) · 78%

**Question:** …

### 2026-06-24 — Best-fit line & slope · 92%

**Question:** …
```

`fixtures/concept-mastery.md`:
```markdown
| Concept | Level | Score | Last seen | Notes / flags |
|---|---|---|---|---|
| Error term (regression) | solid | 83 | 2026-06-24 | note |
| RDD — formal / equation | shaky | 40 | 2026-06-01 | note |
| Best-fit line & slope | forming | 81 | 2026-06-24 | note |
| IV / 2SLS estimator | forming | 76 | 2026-06-27 | note |
```

- [ ] **Step 2: Write the failing test**

`server/test/secondary-parsers.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseJpProgress } from '../parsers/jpProgress.js';
import { parseWikiLog } from '../parsers/wikiLog.js';
import { parseGradebook, parseConceptMastery } from '../parsers/tutorFiles.js';

const fx = (f) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8');

describe('parseJpProgress', () => {
  it('reads frontmatter and averages rolling comp', () => {
    const r = parseJpProgress(fx('progress.md'));
    expect(r).toMatchObject({ level: 'N5', streak: 14, lastSession: '2026-06-11', paused: false });
    expect(r.rollingAvg).toBeCloseTo(0.9, 2);
  });
});

describe('parseWikiLog', () => {
  it('returns newest-first entries with kind and truncated title', () => {
    const r = parseWikiLog(fx('log.md'), 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-07-10', kind: 'teach', title: 'Causal Wk10 fixed effects guided lesson' });
    expect(r[1].kind).toBe('ingest');
  });
});

describe('parseGradebook', () => {
  it('returns graded entries newest-first, skipping ungraded headers', () => {
    const r = parseGradebook(fx('gradebook.md'), 5);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-06-24', concept: 'Best-fit line & slope', pct: 92 });
  });
});

describe('parseConceptMastery', () => {
  it('counts mastery bands', () => {
    const r = parseConceptMastery(fx('concept-mastery.md'));
    expect(r).toEqual({ bands: { solid: 1, forming: 2, shaky: 1 }, total: 4 });
  });
});
```

- [ ] **Step 3: Run** → FAIL (modules missing).

- [ ] **Step 4: Implement**

`server/parsers/jpProgress.js`:
```js
import matter from 'gray-matter';

export function parseJpProgress(md) {
  const { data } = matter(md);
  if (!data.current_level) throw new Error('jp progress frontmatter missing current_level');
  const rollingComp = (data.rolling_comp ?? []).map(Number);
  const rollingAvg = rollingComp.length
    ? rollingComp.reduce((a, b) => a + b, 0) / rollingComp.length : 0;
  const toDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  return {
    level: String(data.current_level),
    streak: Number(data.streak ?? 0),
    rollingComp,
    rollingAvg,
    lastSession: toDateStr(data.last_session),
    paused: Boolean(data.paused),
  };
}
```

`server/parsers/wikiLog.js`:
```js
// Entries look like: "## [2026-07-10] teach | <title> → 6 pages touched. <body…>"
export function parseWikiLog(md, n = 6) {
  const out = [...md.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] (\S+) \| (.+)$/gm)].map((m) => {
    let title = m[3];
    const arrow = title.indexOf('→');
    if (arrow !== -1) title = title.slice(0, arrow);
    return { date: m[1], kind: m[2], title: title.trim() };
  });
  return out.reverse().slice(0, n); // file is chronological; newest last → reverse
}
```

`server/parsers/tutorFiles.js`:
```js
export function parseGradebook(md, n = 5) {
  return [...md.matchAll(/^### (\d{4}-\d{2}-\d{2}) — (.+?) · (\d+)%\s*$/gm)]
    .map((m) => ({ date: m[1], concept: m[2].trim(), pct: Number(m[3]) }))
    .reverse().slice(0, n);
}

export function parseConceptMastery(md) {
  const bands = { solid: 0, forming: 0, shaky: 0 };
  for (const m of md.matchAll(/^\|[^|]+\|\s*(solid|forming|shaky)\s*\|/gm)) bands[m[1]] += 1;
  const total = bands.solid + bands.forming + bands.shaky;
  if (total === 0) throw new Error('no mastery rows found');
  return { bands, total };
}
```

- [ ] **Step 5: Run tests → PASS. Commit**

```bash
git add server/parsers server/test
git commit -m "feat: parsers for JP progress, wiki log, gradebook, concept mastery"
```

---

### Task 5: XP engine (levels, totals, crossings, momentum)

**Files:**
- Create: `server/xp.js`
- Test: `server/test/xp.test.js`

**Interfaces:**
- `LEVELS` — `[{level: 1, name: 'Apprentice', min: 0}, {level: 2, name: 'Practitioner', min: 40}, {level: 3, name: 'Analyst', min: 120}, {level: 4, name: 'Engineer', min: 240}, {level: 5, name: 'Forward-Deployed Master', min: 400}]`.
- `totalXp(reportXp, ledger)` → reportXp + sum of `ledger.entries[].amount`.
- `levelInfo(xp)` → `{ level, name, xpIntoLevel, xpForNext (null at max), pct (0–100 toward next, 100 at max) }`.
- `newCrossings(prevXp, nextXp, ledger)` → array of level numbers crossed that are NOT already in `ledger.crossings`.
- `momentum(quests, todayStr)` → 0–100: over trailing 7 days (including today), `completed dailies / (dailies.length × 7)`, rounded. `localDateStr(date)` helper exported.

- [ ] **Step 1: Write the failing test**

`server/test/xp.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { LEVELS, totalXp, levelInfo, newCrossings, momentum, localDateStr } from '../xp.js';

describe('xp engine', () => {
  it('level table mirrors the report card', () => {
    expect(LEVELS.map((l) => l.min)).toEqual([0, 40, 120, 240, 400]);
    expect(LEVELS[3].name).toBe('Engineer');
  });

  it('totalXp adds report XP and ledger entries', () => {
    expect(totalXp(249, { entries: [{ amount: 15 }, { amount: 10 }], crossings: [] })).toBe(274);
    expect(totalXp(249, { entries: [], crossings: [] })).toBe(249);
  });

  it('levelInfo computes level and progress', () => {
    expect(levelInfo(249)).toEqual({ level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 });
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(450)).toMatchObject({ level: 5, xpForNext: null, pct: 100 });
  });

  it('newCrossings detects threshold crossings not already recorded', () => {
    const ledger = { entries: [], crossings: [{ level: 4, ts: 'x' }] };
    expect(newCrossings(230, 250, ledger)).toEqual([]);           // 4 already recorded
    expect(newCrossings(390, 405, ledger)).toEqual([5]);
    expect(newCrossings(30, 130, { entries: [], crossings: [] })).toEqual([2, 3]);
  });

  it('momentum = completed/possible over trailing 7 days', () => {
    const quests = {
      dailies: [{ id: 'a' }, { id: 'b' }],
      completions: { '2026-07-11': ['a', 'b'], '2026-07-10': ['a'] },
      sides: [], mains: [],
    };
    // 3 completions / (2 dailies * 7 days) = 21%
    expect(momentum(quests, '2026-07-11')).toBe(21);
    expect(momentum({ dailies: [], completions: {}, sides: [], mains: [] }, '2026-07-11')).toBe(0);
  });

  it('localDateStr formats YYYY-MM-DD', () => {
    expect(localDateStr(new Date(2026, 6, 11))).toBe('2026-07-11');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `server/xp.js`**

```js
export const LEVELS = [
  { level: 1, name: 'Apprentice', min: 0 },
  { level: 2, name: 'Practitioner', min: 40 },
  { level: 3, name: 'Analyst', min: 120 },
  { level: 4, name: 'Engineer', min: 240 },
  { level: 5, name: 'Forward-Deployed Master', min: 400 },
];

export const totalXp = (reportXp, ledger) =>
  reportXp + ledger.entries.reduce((sum, e) => sum + e.amount, 0);

export function levelInfo(xp) {
  const idx = LEVELS.findLastIndex((l) => xp >= l.min);
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const xpIntoLevel = xp - cur.min;
  const xpForNext = next ? next.min - cur.min : null;
  const pct = next ? Math.round((xpIntoLevel / xpForNext) * 100) : 100;
  return { level: cur.level, name: cur.name, xpIntoLevel, xpForNext, pct };
}

export function newCrossings(prevXp, nextXp, ledger) {
  const recorded = new Set(ledger.crossings.map((c) => c.level));
  return LEVELS.filter((l) => prevXp < l.min && nextXp >= l.min && !recorded.has(l.level))
    .map((l) => l.level);
}

export const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function momentum(quests, todayStr) {
  const per = quests.dailies.length;
  if (per === 0) return 0;
  const [y, m, d] = todayStr.split('-').map(Number);
  let done = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = localDateStr(new Date(y, m - 1, d - i));
    done += (quests.completions[day] ?? []).length;
  }
  return Math.round((done / (per * 7)) * 100);
}
```

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add server/xp.js server/test/xp.test.js
git commit -m "feat: xp engine - level table, totals, crossings, momentum"
```

---

### Task 6: Express app + GET /api/dashboard (aggregation with per-source degradation)

**Files:**
- Create: `server/app.js`, `server/routes/dashboard.js`, `server/vaultReader.js`, `server/test/helpers/fixtureEnv.js`
- Test: `server/test/dashboard-route.test.js`

**Interfaces:**
- `createApp(config)` → Express app (exported for tests; `index.js` comes in Task 9).
- `readVaultSection(file, parser)` → `{ ok: true, data }` or `{ ok: false, error: '<message>' }` — never throws.
- `GET /api/dashboard` → `{ ok: true, data: { learning, tutor, activity, japanese, quests, health, agenda, settings, xp, momentum, today } }` where:
  - `learning` = report-card section result (degradable), `tutor` = `{ gradebook, mastery }` (each degradable), `activity` = wiki log (degradable), `japanese` = jp progress (degradable)
  - `quests/health/agenda/settings` = state files (from `readStateFile`)
  - `xp` = `{ total, reportXp, ledgerXp, ...levelInfo(total) }` — when the report card is degraded, `reportXp` falls back to 0 and `xp.degraded = true`
  - `momentum` = number, `today` = `localDateStr()`
- `server/test/helpers/fixtureEnv.js` exports `makeFixtureEnv()` → creates a temp dir tree `{vaultDir, jpVaultDir, stateDir, config}` populated by copying `server/test/fixtures/*` into the right relative paths (`wiki/syntheses/learning-report-card.md`, `tutor/gradebook.md`, `tutor/concept-mastery.md`, `wiki/log.md`, jp `progress.md`). All route tests use it.

- [ ] **Step 1: Write helper + failing test**

`server/test/helpers/fixtureEnv.js`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../config.js';

export function makeFixtureEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-env-'));
  const vaultDir = path.join(root, 'second-brain');
  const jpVaultDir = path.join(root, 'japanesetutor');
  const fx = path.join(import.meta.dirname, '..', 'fixtures');
  const put = (rel, fixture) => {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(fx, fixture), dest);
  };
  put('second-brain/wiki/syntheses/learning-report-card.md', 'learning-report-card.md');
  put('second-brain/tutor/gradebook.md', 'gradebook.md');
  put('second-brain/tutor/concept-mastery.md', 'concept-mastery.md');
  put('second-brain/wiki/log.md', 'log.md');
  put('japanesetutor/progress.md', 'progress.md');
  const config = loadConfig({ WAHNAHBE_VAULT: vaultDir, WAHNAHBE_JP_VAULT: jpVaultDir });
  return { root, vaultDir, jpVaultDir, stateDir: config.stateDir, config };
}
```

`server/test/dashboard-route.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

describe('GET /api/dashboard', () => {
  it('aggregates vault sources, state, and xp', async () => {
    const env = makeFixtureEnv();
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(res.body.ok).toBe(true);
    expect(d.learning.ok).toBe(true);
    expect(d.learning.data.totalXp).toBe(249);
    expect(d.japanese.data.level).toBe('N5');
    expect(d.tutor.mastery.data.bands.solid).toBe(1);
    expect(d.activity.data[0].kind).toBe('teach');
    expect(d.health.weighIns[0].lbs).toBe(200.0);
    expect(d.xp).toMatchObject({ total: 249, level: 4, name: 'Engineer' });
    expect(d.momentum).toBe(0);
  });

  it('degrades a missing source without failing the request', async () => {
    const env = makeFixtureEnv();
    fs.rmSync(env.config.sources.jpProgress);
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.japanese.ok).toBe(false);
    expect(res.body.data.japanese.error).toBeTruthy();
    expect(res.body.data.learning.ok).toBe(true);
  });

  it('degrades xp to ledger-only when report card unreadable', async () => {
    const env = makeFixtureEnv();
    fs.writeFileSync(env.config.sources.reportCard, '# gutted');
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.body.data.learning.ok).toBe(false);
    expect(res.body.data.xp).toMatchObject({ total: 0, degraded: true });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`server/vaultReader.js`:
```js
import fs from 'node:fs';

export function readVaultSection(file, parser) {
  try {
    return { ok: true, data: parser(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { ok: false, error: `${file}: ${err.message}` };
  }
}
```

`server/routes/dashboard.js`:
```js
import { Router } from 'express';
import { readVaultSection } from '../vaultReader.js';
import { parseReportCard } from '../parsers/reportCard.js';
import { parseJpProgress } from '../parsers/jpProgress.js';
import { parseWikiLog } from '../parsers/wikiLog.js';
import { parseGradebook, parseConceptMastery } from '../parsers/tutorFiles.js';
import { readStateFile } from '../state/io.js';
import { totalXp, levelInfo, momentum, localDateStr } from '../xp.js';

export function dashboardRouter(config) {
  const r = Router();
  r.get('/dashboard', (_req, res) => {
    const s = config.sources;
    const learning = readVaultSection(s.reportCard, parseReportCard);
    const japanese = readVaultSection(s.jpProgress, parseJpProgress);
    const activity = readVaultSection(s.wikiLog, parseWikiLog);
    const tutor = {
      gradebook: readVaultSection(s.gradebook, parseGradebook),
      mastery: readVaultSection(s.conceptMastery, parseConceptMastery),
    };
    const quests = readStateFile(config.stateDir, 'quests');
    const health = readStateFile(config.stateDir, 'health');
    const agenda = readStateFile(config.stateDir, 'agenda');
    const settings = readStateFile(config.stateDir, 'settings');
    const ledger = readStateFile(config.stateDir, 'xpLedger');

    const reportXp = learning.ok ? learning.data.totalXp : 0;
    const total = totalXp(reportXp, ledger);
    const ledgerXp = total - reportXp;
    const xp = { total, reportXp, ledgerXp, ...levelInfo(total), ...(learning.ok ? {} : { degraded: true }) };
    const today = localDateStr();

    res.json({ ok: true, data: {
      learning, japanese, activity, tutor,
      quests, health, agenda, settings,
      xp, momentum: momentum(quests, today), today,
    } });
  });
  return r;
}
```

`server/app.js`:
```js
import express from 'express';
import { dashboardRouter } from './routes/dashboard.js';

export function createApp(config) {
  const app = express();
  app.use(express.json());
  app.use('/api', dashboardRouter(config));
  // Central error envelope for sync/async route errors.
  app.use((err, _req, res, _next) => {
    res.status(err.status ?? 500).json({ ok: false, error: err.message });
  });
  return app;
}
```

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/routes server/vaultReader.js server/test
git commit -m "feat: dashboard aggregation endpoint with per-source degradation"
```

---

### Task 7: Mutation routes — quests (dailies / sides / mains) with XP awards

**Files:**
- Create: `server/routes/quests.js`, `server/awards.js`
- Modify: `server/app.js` (mount router)
- Test: `server/test/quests-route.test.js`

**Interfaces:**
- `awardXp(config, { amount, stat, reason, source })` (in `server/awards.js`) → reads ledger + report XP, appends entry, detects `newCrossings`, appends crossing records, writes ledger atomically. Returns `{ ledger, xp: levelInfo(after), total, ascended: number|null }`. Used by quests routes, training, and the `/api/xp/award` endpoint (Task 8).
- Routes (all return `{ok, data}`; invalid ids/payloads → 400/404 envelope):
  - `POST /api/quests/daily/:id/complete` — no-op error 409 if already completed today. Awards the daily's XP. Returns `{ quests, award }`.
  - `POST /api/quests/side` body `{title, xp (10|25|50), stat}` → adds side quest.
  - `POST /api/quests/side/:id/complete` — marks done, awards XP.
  - `DELETE /api/quests/side/:id`
  - `PATCH /api/quests/main/:id` body `{pct}` → updates main quest progress.
  - `PUT /api/quests/dailies` body `{dailies: [{id?, title, xp, stat}]}` → replaces daily definitions (settings drawer edit).

- [ ] **Step 1: Write the failing test**

`server/test/quests-route.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';
import { readStateFile, writeStateFile, DEFAULTS } from '../state/io.js';

let env, app;
beforeEach(() => { env = makeFixtureEnv(); app = createApp(env.config); });

describe('daily quests', () => {
  it('completes a daily once, awards XP to the ledger', async () => {
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.body.ok).toBe(true);
    expect(res.body.data.award.total).toBe(249 + 15);
    const ledger = readStateFile(env.stateDir, 'xpLedger');
    expect(ledger.entries[0]).toMatchObject({ amount: 15, source: 'daily:d-train' });
    const again = await request(app).post('/api/quests/daily/d-train/complete');
    expect(again.status).toBe(409);
  });

  it('404s on unknown daily', async () => {
    expect((await request(app).post('/api/quests/daily/nope/complete')).status).toBe(404);
  });
});

describe('side quests', () => {
  it('adds, completes (awards), and deletes', async () => {
    const add = await request(app).post('/api/quests/side')
      .send({ title: 'SHIP DASHBOARD', xp: 25, stat: 'Programming & Implementation' });
    const id = add.body.data.quests.sides[0].id;
    const done = await request(app).post(`/api/quests/side/${id}/complete`);
    expect(done.body.data.quests.sides[0].done).toBe(true);
    expect(done.body.data.award.total).toBe(274);
    const del = await request(app).delete(`/api/quests/side/${id}`);
    expect(del.body.data.quests.sides).toHaveLength(0);
  });

  it('rejects invalid xp tier', async () => {
    const res = await request(app).post('/api/quests/side').send({ title: 'X', xp: 7, stat: 'GENERAL' });
    expect(res.status).toBe(400);
  });
});

describe('main quests + daily config', () => {
  it('updates main quest pct', async () => {
    const quests = { ...DEFAULTS.quests, mains: [{ id: 'm1', title: 'RECOMP ARC', desc: '', deadline: '', pct: 10 }] };
    writeStateFile(env.stateDir, 'quests', quests);
    const res = await request(app).patch('/api/quests/main/m1').send({ pct: 45 });
    expect(res.body.data.quests.mains[0].pct).toBe(45);
  });

  it('replaces daily definitions', async () => {
    const res = await request(app).put('/api/quests/dailies')
      .send({ dailies: [{ title: 'GYM', xp: 20, stat: 'GENERAL' }] });
    expect(res.body.data.quests.dailies).toHaveLength(1);
    expect(res.body.data.quests.dailies[0].id).toBeTruthy();
  });
});

describe('ascension', () => {
  it('records a level crossing once', async () => {
    writeStateFile(env.stateDir, 'xpLedger', {
      entries: [{ ts: 't', amount: 145, stat: 'GENERAL', reason: 'seed', source: 'test' }],
      crossings: [],
    }); // total = 394; +15 crosses 400 → level 5
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.body.data.award.ascended).toBe(5);
    const ledger = readStateFile(env.stateDir, 'xpLedger');
    expect(ledger.crossings).toEqual([{ level: 5, ts: expect.any(String) }]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`server/awards.js`:
```js
import fs from 'node:fs';
import { readStateFile, writeStateFile } from './state/io.js';
import { parseReportCard } from './parsers/reportCard.js';
import { totalXp, levelInfo, newCrossings } from './xp.js';

function reportXpOrZero(config) {
  try {
    return parseReportCard(fs.readFileSync(config.sources.reportCard, 'utf8')).totalXp;
  } catch {
    return 0;
  }
}

export function awardXp(config, { amount, stat, reason, source }) {
  const ledger = readStateFile(config.stateDir, 'xpLedger');
  const reportXp = reportXpOrZero(config);
  const before = totalXp(reportXp, ledger);
  const entry = { ts: new Date().toISOString(), amount, stat, reason, source };
  const after = before + amount;
  const crossed = newCrossings(before, after, ledger);
  const next = {
    entries: [...ledger.entries, entry],
    crossings: [...ledger.crossings, ...crossed.map((level) => ({ level, ts: entry.ts }))],
  };
  writeStateFile(config.stateDir, 'xpLedger', next);
  return { ledger: next, total: after, xp: levelInfo(after), ascended: crossed.at(-1) ?? null };
}
```

`server/routes/quests.js`:
```js
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readStateFile, writeStateFile } from '../state/io.js';
import { StatTag } from '../state/schemas.js';
import { awardXp } from '../awards.js';
import { localDateStr } from '../xp.js';

const fail = (res, status, error) => res.status(status).json({ ok: false, error });

export function questsRouter(config) {
  const r = Router();
  const load = () => readStateFile(config.stateDir, 'quests');
  const save = (q) => writeStateFile(config.stateDir, 'quests', q);

  r.post('/quests/daily/:id/complete', (req, res) => {
    const q = load();
    const daily = q.dailies.find((d) => d.id === req.params.id);
    if (!daily) return fail(res, 404, `no daily ${req.params.id}`);
    const today = localDateStr();
    const doneToday = q.completions[today] ?? [];
    if (doneToday.includes(daily.id)) return fail(res, 409, 'already completed today');
    const quests = save({ ...q, completions: { ...q.completions, [today]: [...doneToday, daily.id] } });
    const award = awardXp(config, {
      amount: daily.xp, stat: daily.stat, reason: daily.title, source: `daily:${daily.id}`,
    });
    res.json({ ok: true, data: { quests, award } });
  });

  const SideBody = z.object({ title: z.string().min(1), xp: z.union([z.literal(10), z.literal(25), z.literal(50)]), stat: StatTag });
  r.post('/quests/side', (req, res) => {
    const body = SideBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    const side = { id: randomUUID(), ...body.data, done: false, createdAt: new Date().toISOString() };
    res.json({ ok: true, data: { quests: save({ ...q, sides: [...q.sides, side] }) } });
  });

  r.post('/quests/side/:id/complete', (req, res) => {
    const q = load();
    const side = q.sides.find((s) => s.id === req.params.id);
    if (!side) return fail(res, 404, 'no such side quest');
    if (side.done) return fail(res, 409, 'already complete');
    const quests = save({ ...q, sides: q.sides.map((s) => (s.id === side.id ? { ...s, done: true } : s)) });
    const award = awardXp(config, { amount: side.xp, stat: side.stat, reason: side.title, source: `side:${side.id}` });
    res.json({ ok: true, data: { quests, award } });
  });

  r.delete('/quests/side/:id', (req, res) => {
    const q = load();
    if (!q.sides.some((s) => s.id === req.params.id)) return fail(res, 404, 'no such side quest');
    res.json({ ok: true, data: { quests: save({ ...q, sides: q.sides.filter((s) => s.id !== req.params.id) }) } });
  });

  r.patch('/quests/main/:id', (req, res) => {
    const body = z.object({ pct: z.number().min(0).max(100) }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    if (!q.mains.some((m) => m.id === req.params.id)) return fail(res, 404, 'no such main quest');
    const quests = save({ ...q, mains: q.mains.map((m) => (m.id === req.params.id ? { ...m, pct: body.data.pct } : m)) });
    res.json({ ok: true, data: { quests } });
  });

  r.put('/quests/dailies', (req, res) => {
    const body = z.object({ dailies: z.array(z.object({
      id: z.string().optional(), title: z.string().min(1), xp: z.number().int().positive(), stat: StatTag,
    })) }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    const dailies = body.data.dailies.map((d) => ({ ...d, id: d.id ?? randomUUID() }));
    res.json({ ok: true, data: { quests: save({ ...q, dailies }) } });
  });

  return r;
}
```

Modify `server/app.js` — add after the dashboard mount:
```js
import { questsRouter } from './routes/quests.js';
// inside createApp, after dashboardRouter line:
  app.use('/api', questsRouter(config));
```

- [ ] **Step 4: Run all server tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: quest mutation routes with xp awards and ascension crossings"
```

---

### Task 8: Mutation routes — health, agenda, settings, direct XP award, main quest add

**Files:**
- Create: `server/routes/stateRoutes.js`
- Modify: `server/app.js` (mount)
- Test: `server/test/state-routes.test.js`

**Interfaces:**
- `POST /api/health/gauge` body `{hp?, mp?}` (0–100) → updated health.
- `POST /api/health/weighins` body `{lbs, date?}` (date defaults today) → appends, keeps `weighIns` sorted by date ascending.
- `DELETE /api/health/weighins/:date` → removes entries with that date (404 if none).
- `POST /api/agenda` body `{date, time, title, type}` → adds manual event. `DELETE /api/agenda/:id`.
- `PUT /api/settings` body = full settings object.
- `POST /api/xp/award` body `{amount (int, may be negative, |amount| ≤ 500), stat, reason, source?='manual'}` → `awardXp` result. This is the endpoint the `/award` skill uses.
- `POST /api/quests/main` body `{title, desc?, deadline?}` → adds a main quest at 0%.

- [ ] **Step 1: Write the failing test**

`server/test/state-routes.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

let env, app;
beforeEach(() => { env = makeFixtureEnv(); app = createApp(env.config); });

it('sets gauges with clamping validation', async () => {
  const res = await request(app).post('/api/health/gauge').send({ hp: 62 });
  expect(res.body.data.health).toMatchObject({ hp: 62, mp: 100 });
  expect((await request(app).post('/api/health/gauge').send({ hp: 130 })).status).toBe(400);
});

it('logs and deletes weigh-ins, kept sorted', async () => {
  await request(app).post('/api/health/weighins').send({ lbs: 194.6, date: '2026-07-11' });
  const res = await request(app).post('/api/health/weighins').send({ lbs: 196.2, date: '2026-06-01' });
  expect(res.body.data.health.weighIns.map((w) => w.lbs)).toEqual([200.0, 196.2, 194.6]);
  const del = await request(app).delete('/api/health/weighins/2026-06-01');
  expect(del.body.data.health.weighIns).toHaveLength(2);
  expect((await request(app).delete('/api/health/weighins/1999-01-01')).status).toBe(404);
});

it('adds and deletes agenda events', async () => {
  const add = await request(app).post('/api/agenda')
    .send({ date: '2026-07-12', time: '09:30', title: 'BU LECTURE', type: 'SCHOOL' });
  const ev = add.body.data.agenda.events[0];
  expect(ev).toMatchObject({ source: 'manual', type: 'SCHOOL' });
  const del = await request(app).delete(`/api/agenda/${ev.id}`);
  expect(del.body.data.agenda.events).toHaveLength(0);
});

it('replaces settings', async () => {
  const res = await request(app).put('/api/settings')
    .send({ title: 'DATA OPERATIVE', scanlines: false, jpLabels: true, reducedMotion: false });
  expect(res.body.data.settings.scanlines).toBe(false);
});

it('awards direct XP and enforces bounds', async () => {
  const res = await request(app).post('/api/xp/award')
    .send({ amount: 20, stat: 'Programming & Implementation', reason: 'built the watcher' });
  expect(res.body.data.total).toBe(269);
  expect((await request(app).post('/api/xp/award').send({ amount: 9999, stat: 'GENERAL', reason: 'x' })).status).toBe(400);
});

it('adds a main quest at 0%', async () => {
  const res = await request(app).post('/api/quests/main').send({ title: 'RECOMP ARC', deadline: '2026-12-31' });
  expect(res.body.data.quests.mains[0]).toMatchObject({ pct: 0, title: 'RECOMP ARC' });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `server/routes/stateRoutes.js`**

```js
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readStateFile, writeStateFile } from '../state/io.js';
import { schemas, StatTag } from '../state/schemas.js';
import { awardXp } from '../awards.js';
import { localDateStr } from '../xp.js';

const fail = (res, status, error) => res.status(status).json({ ok: false, error });
const gauge = z.number().min(0).max(100);

export function stateRouter(config) {
  const r = Router();
  const rw = (name, fn) => {
    const cur = readStateFile(config.stateDir, name);
    return writeStateFile(config.stateDir, name, fn(cur));
  };

  r.post('/health/gauge', (req, res) => {
    const body = z.object({ hp: gauge.optional(), mp: gauge.optional() }).strict().safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    res.json({ ok: true, data: { health: rw('health', (h) => ({ ...h, ...body.data })) } });
  });

  r.post('/health/weighins', (req, res) => {
    const body = z.object({ lbs: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const entry = { lbs: body.data.lbs, date: body.data.date ?? localDateStr() };
    const health = rw('health', (h) => ({
      ...h,
      weighIns: [...h.weighIns, entry].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    res.json({ ok: true, data: { health } });
  });

  r.delete('/health/weighins/:date', (req, res) => {
    const cur = readStateFile(config.stateDir, 'health');
    if (!cur.weighIns.some((w) => w.date === req.params.date)) return fail(res, 404, 'no weigh-in on that date');
    const health = writeStateFile(config.stateDir, 'health', {
      ...cur, weighIns: cur.weighIns.filter((w) => w.date !== req.params.date),
    });
    res.json({ ok: true, data: { health } });
  });

  r.post('/agenda', (req, res) => {
    const body = schemas.agenda.shape.events.element
      .omit({ id: true, source: true, gcalId: true }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const event = { id: randomUUID(), source: 'manual', ...body.data };
    res.json({ ok: true, data: { agenda: rw('agenda', (a) => ({ events: [...a.events, event] })) } });
  });

  r.delete('/agenda/:id', (req, res) => {
    const cur = readStateFile(config.stateDir, 'agenda');
    if (!cur.events.some((e) => e.id === req.params.id)) return fail(res, 404, 'no such event');
    res.json({ ok: true, data: { agenda: writeStateFile(config.stateDir, 'agenda', {
      events: cur.events.filter((e) => e.id !== req.params.id),
    }) } });
  });

  r.put('/settings', (req, res) => {
    const body = schemas.settings.safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    res.json({ ok: true, data: { settings: writeStateFile(config.stateDir, 'settings', body.data) } });
  });

  r.post('/xp/award', (req, res) => {
    const body = z.object({
      amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 500, 'amount must be nonzero, |amount| <= 500'),
      stat: StatTag, reason: z.string().min(1), source: z.string().default('manual'),
    }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    res.json({ ok: true, data: awardXp(config, body.data) });
  });

  r.post('/quests/main', (req, res) => {
    const body = z.object({
      title: z.string().min(1), desc: z.string().default(''),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
    }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const main = { id: randomUUID(), pct: 0, ...body.data };
    res.json({ ok: true, data: { quests: rw('quests', (q) => ({ ...q, mains: [...q.mains, main] })) } });
  });

  return r;
}
```

Modify `server/app.js`: `import { stateRouter } from './routes/stateRoutes.js';` and `app.use('/api', stateRouter(config));`.

- [ ] **Step 4: Run all server tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: health, agenda, settings, direct xp award, main quest routes"
```

---

### Task 9: File watcher + SSE + server entrypoint

**Files:**
- Create: `server/watch.js`, `server/routes/events.js`, `server/index.js`
- Modify: `server/app.js`
- Test: `server/test/events.test.js`

**Interfaces:**
- `createBus()` → `{ emit(type), subscribe(fn) → unsubscribe }` — tiny event fan-out, testable without chokidar.
- `startWatcher(config, bus)` → chokidar watcher on all `config.sources` paths + `config.stateDir`, debounced 300 ms, emits `bus.emit('refresh')`. Returns watcher (has `.close()`).
- `eventsRouter(bus)` → `GET /api/events` — SSE stream; sends `event: refresh\ndata: {}\n\n` on bus refresh, and a `: ping` comment every 25 s.
- `createApp(config, bus)` — second param (default `createBus()`), mounts events router.
- `server/index.js` — boot: ensure state dir defaults exist (write any missing state file's DEFAULTS), start watcher, listen on `config.port`, log to console + append to `logs/server.log`.

- [ ] **Step 1: Write the failing test**

`server/test/events.test.js`:
```js
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { createApp } from '../app.js';
import { createBus } from '../watch.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

function openSse(port) {
  return new Promise((resolve) => {
    const chunks = [];
    const req = http.get({ port, path: '/api/events' }, (res) => {
      res.on('data', (c) => chunks.push(c.toString()));
      resolve({ res, chunks, close: () => req.destroy() });
    });
  });
}

describe('SSE /api/events', () => {
  it('pushes refresh events from the bus', async () => {
    const env = makeFixtureEnv();
    const bus = createBus();
    const server = createApp(env.config, bus).listen(0);
    const port = server.address().port;
    const sse = await openSse(port);
    bus.emit('refresh');
    await new Promise((r) => setTimeout(r, 100));
    expect(sse.chunks.join('')).toContain('event: refresh');
    sse.close();
    server.close();
  });
});

describe('bus', () => {
  it('unsubscribes cleanly', () => {
    const bus = createBus();
    let n = 0;
    const un = bus.subscribe(() => { n += 1; });
    bus.emit('refresh');
    un();
    bus.emit('refresh');
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`server/watch.js`:
```js
import chokidar from 'chokidar';

export function createBus() {
  const subs = new Set();
  return {
    emit(type) { for (const fn of subs) fn(type); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export function startWatcher(config, bus) {
  const paths = [...Object.values(config.sources), config.stateDir];
  let timer = null;
  const watcher = chokidar.watch(paths, { ignoreInitial: true });
  watcher.on('all', () => {
    clearTimeout(timer);
    timer = setTimeout(() => bus.emit('refresh'), 300);
  });
  return watcher;
}
```

`server/routes/events.js`:
```js
import { Router } from 'express';

export function eventsRouter(bus) {
  const r = Router();
  r.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    const unsubscribe = bus.subscribe((type) => res.write(`event: ${type}\ndata: {}\n\n`));
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => { unsubscribe(); clearInterval(ping); });
  });
  return r;
}
```

Modify `server/app.js`:
```js
import { createBus } from './watch.js';
import { eventsRouter } from './routes/events.js';

export function createApp(config, bus = createBus()) {
  // …existing middleware/mounts…
  app.use('/api', eventsRouter(bus));
  // …
}
```

`server/index.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createApp } from './app.js';
import { createBus, startWatcher } from './watch.js';
import { readStateFile, writeStateFile } from './state/io.js';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.appendFileSync(path.join(config.logDir, 'server.log'), line);
}

// Bootstrap: materialize any missing state file with its defaults.
for (const name of ['quests', 'health', 'agenda', 'xpLedger', 'settings']) {
  if (!fs.existsSync(path.join(config.stateDir, `${name}.json`))) {
    writeStateFile(config.stateDir, name, readStateFile(config.stateDir, name));
    log(`seeded ${name}.json`);
  }
}

const bus = createBus();
startWatcher(config, bus);
const app = createApp(config, bus);
app.listen(config.port, () => log(`WAHNAHBE SYSTEM online — http://localhost:${config.port}`));
process.on('uncaughtException', (e) => { log(`FATAL ${e.stack}`); process.exit(1); });
```

- [ ] **Step 4: Run tests → PASS. Manual smoke:** `npm run dev --workspace=server`, then `curl http://localhost:4777/api/dashboard` — expect `{"ok":true,…}` with real vault data (XP 249). Confirm `C:\Users\gjgut\second-brain\system\` now contains the five seeded JSON files. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: file watcher, SSE events, server entrypoint with state bootstrap"
```

---

### Task 10: Web scaffold — Vite/React, theme, API client + live dashboard hook

**Files:**
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`, `web/src/main.jsx`, `web/src/App.jsx` (placeholder shell), `web/src/theme.js`, `web/src/api.js`, `web/src/hooks/useDashboard.js`
- Test: `web/test/api.test.js` (Vitest, jsdom)

**Interfaces:**
- `theme` — exported constants: `C = { bg:'#08050F', panel:'rgba(22,12,40,0.72)', mag:'#D24BFF', cyan:'#3FE8FF', text:'#F2EAFF', deep:'rgba(11,7,22,.9)', dim:'rgba(242,234,255,.5)' }`, `clip(n)` → corner-cut clip-path string, `panelStyle`, `fonts = { display:"'Rajdhani',sans-serif", mono:"'Share Tech Mono',monospace", jp:"'Noto Sans JP',sans-serif" }`.
- `api.get(path)` / `api.send(method, path, body)` → parsed envelope; throws `Error(error)` on `ok: false` (message shown as in-theme notification by callers).
- `useDashboard()` → `{ data, error, refresh, act }` where `act(method, path, body)` performs a mutation, merges returned `data` slices (`quests`, `health`, `agenda`, `settings`) into `data`, returns the response data (so callers can read `award`). Subscribes to `/api/events` SSE; on `refresh` event → re-fetch `/api/dashboard`.

- [ ] **Step 1: Write scaffold files**

`web/package.json`:
```json
{
  "name": "@thesystem/web",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest run" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": {
    "@testing-library/react": "^16.0.0", "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0", "vite": "^5.4.0", "vitest": "^2.0.0"
  }
}
```

`web/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4777' } },
  test: { environment: 'jsdom', include: ['test/**/*.test.js*'] },
});
```

`web/index.html` — copy the `<helmet>` contents of `docs/design/wahnahbe-v2.dc.html` (font preconnects + Google Fonts link + the global `<style>` block with scrollbar/keyframes/input styling) into `<head>`, set `<title>WAHNAHBE SYSTEM</title>`, body has `<div id="root"></div>` and `<script type="module" src="/src/main.jsx"></script>`.

`web/src/theme.js`:
```js
export const C = {
  bg: '#08050F', panel: 'rgba(22,12,40,0.72)', mag: '#D24BFF', cyan: '#3FE8FF',
  text: '#F2EAFF', deep: 'rgba(11,7,22,.9)', dim: 'rgba(242,234,255,.5)',
  magBorder: 'rgba(210,75,255,.45)', cyanDim: 'rgba(63,232,255,.6)',
};
export const fonts = {
  display: "'Rajdhani',sans-serif", mono: "'Share Tech Mono',monospace", jp: "'Noto Sans JP',sans-serif",
};
export const clip = (n) =>
  `polygon(${n}px 0,100% 0,100% calc(100% - ${n}px),calc(100% - ${n}px) 100%,0 100%,0 ${n}px)`;
export const panelStyle = {
  display: 'flex', flexDirection: 'column', background: C.panel, backdropFilter: 'blur(8px)',
  border: `1px solid ${C.magBorder}`, clipPath: clip(14),
  boxShadow: 'inset 0 0 26px rgba(210,75,255,.06)', overflow: 'hidden',
};
```

`web/src/api.js`:
```js
async function unwrap(res) {
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.data;
}
export const api = {
  get: (path) => fetch(`/api${path}`).then(unwrap),
  send: (method, path, body) => fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(unwrap),
};
```

`web/src/hooks/useDashboard.js`:
```js
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const STATE_SLICES = ['quests', 'health', 'agenda', 'settings'];

export function useDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    api.get('/dashboard').then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource('/api/events');
    es.addEventListener('refresh', refresh);
    return () => es.close();
  }, [refresh]);

  const act = useCallback(async (method, path, body) => {
    const result = await api.send(method, path, body);
    setData((prev) => {
      if (!prev) return prev;
      const merged = { ...prev };
      for (const k of STATE_SLICES) if (result[k]) merged[k] = result[k];
      if (result.award) merged.xp = { ...merged.xp, total: result.award.total, ...result.award.xp };
      return merged;
    });
    return result;
  }, []);

  return { data, error, refresh, act };
}
```

`web/src/main.jsx`:
```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App />);
```

`web/src/App.jsx` (placeholder until Task 14):
```jsx
import React from 'react';
import { useDashboard } from './hooks/useDashboard.js';
import { C, fonts } from './theme.js';

export default function App() {
  const { data, error } = useDashboard();
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: fonts.mono, padding: 20 }}>
      {error && <div>[SYS] LINK ERROR: {error}</div>}
      {!data ? '[SYS] CONNECTING…' : `WAHNAHBE ONLINE — LV ${data.xp.level} · ${data.xp.total} XP`}
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test**

`web/test/api.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { api } from '../src/api.js';

describe('api client', () => {
  it('unwraps ok envelopes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data: { x: 1 } }) });
    expect(await api.get('/dashboard')).toEqual({ x: 1 });
    expect(fetch).toHaveBeenCalledWith('/api/dashboard');
  });
  it('throws the envelope error on ok:false', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 409, json: async () => ({ ok: false, error: 'already completed today' }) });
    await expect(api.send('POST', '/quests/daily/x/complete')).rejects.toThrow('already completed today');
  });
});
```

- [ ] **Step 3: Run** `npm install && npx vitest run --root web` → api tests PASS (write test before api.js if strict-TDD ordering is desired; either order, both must pass).

- [ ] **Step 4: Manual smoke:** run server (`npm run dev --workspace=server`) + `npm run dev --workspace=web`, open `http://localhost:5173` — placeholder shows `WAHNAHBE ONLINE — LV 4 · 249 XP`. Edit a state JSON by hand → page auto-refreshes via SSE.

- [ ] **Step 5: Commit**

```bash
git add web package-lock.json
git commit -m "feat: web scaffold with theme, api client, live dashboard hook"
```

---

### Task 11: Header ticker + Agenda strip components

**Files:**
- Create: `web/src/components/HeaderTicker.jsx`, `web/src/components/AgendaStrip.jsx`, `web/src/components/bits.jsx`
- Test: `web/test/components.test.jsx` (started here, extended in later tasks)

**Interfaces:**
- `bits.jsx` exports: `SectionTitle({children, jp, showJp})`, `Bar({pct, grad, h})` (angled progress bar), `HudButton({onClick, children, small})`, `HudInput`, `HudSelect` — shared HUD primitives styled per design (deep bg `C.deep`, magenta borders, Share Tech Mono, clip-path corners).
- `HeaderTicker({xp, momentum, settings, learning, onOpenSettings, onToggleMotion})` — wordmark + `GUTIERREZ, J. · DATA OPERATIVE · «{settings.title}»`, LEVEL number + XP bar (`xp.pct`, label `{xp.xpIntoLevel}/{xp.xpForNext} XP`), live clock (1 s interval, date `YYYY.MM.DD` + time `HH:MM:SS`), momentum SVG ring (r=18, `stroke-dasharray = 2πr × momentum/100`), SYS://CONFIG + motion buttons.
- `AgendaStrip({agenda, today, onAdd, onDelete})` — chips for today's events sorted by time (type colors: SCHOOL cyan, INTERVIEW magenta, WORK white, TRAINING green `#6BFF9E`, OTHER dim), `[SYS] NO SCHEDULED EVENTS TODAY` empty state, `+N UPCOMING` count (events with date > today), quick-add row (date+time+title+type+`+`). `onAdd(event)` and `onDelete(id)` are async callbacks provided by App.

- [ ] **Step 1: Write the failing test** (component render smoke via testing-library):

`web/test/components.test.jsx`:
```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeaderTicker } from '../src/components/HeaderTicker.jsx';
import { AgendaStrip } from '../src/components/AgendaStrip.jsx';

const xp = { total: 249, level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 };
const settings = { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: false };

it('HeaderTicker shows level, xp label, title', () => {
  render(<HeaderTicker xp={xp} momentum={21} settings={settings} learning={{ ok: true, data: {} }}
    onOpenSettings={() => {}} onToggleMotion={() => {}} />);
  expect(screen.getByText('WAHNAHBE')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText(/9 \/ 160 XP/)).toBeTruthy();
});

it('AgendaStrip shows empty state and upcoming count', () => {
  const agenda = { events: [
    { id: '1', date: '2026-07-12', time: '09:00', title: 'LECTURE', type: 'SCHOOL', source: 'manual' },
  ] };
  render(<AgendaStrip agenda={agenda} today="2026-07-11" onAdd={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText(/NO SCHEDULED EVENTS TODAY/)).toBeTruthy();
  expect(screen.getByText('+1 UPCOMING')).toBeTruthy();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Port markup/styling from `docs/design/wahnahbe-v2.dc.html` sections `HEADER TICKER` and `AGENDA STRIP` (inline styles → JSX style objects using `C`, `fonts`, `clip`). Core structure:

`web/src/components/bits.jsx`:
```jsx
import React from 'react';
import { C, fonts, clip } from '../theme.js';

export const SectionTitle = ({ children, jp, showJp }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '12px 16px 9px', borderBottom: `1px solid rgba(210,75,255,.35)` }}>
    <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 15, letterSpacing: '.2em', color: C.mag }}>{children}</div>
    {showJp && jp && <div style={{ fontFamily: fonts.jp, fontSize: 10, color: 'rgba(63,232,255,.55)' }}>{jp}</div>}
  </div>
);

export const Bar = ({ pct, grad = `linear-gradient(90deg,#7A1FBF,${C.mag} 60%,${C.cyan})`, h = 9 }) => (
  <div style={{ position: 'relative', height: h, background: C.deep, border: '1px solid rgba(210,75,255,.4)',
    clipPath: 'polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)' }}>
    <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: grad,
      boxShadow: '0 0 10px rgba(210,75,255,.7)' }} />
  </div>
);

export const HudButton = ({ onClick, children, small }) => (
  <button onClick={onClick} style={{ background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)',
    color: C.cyan, fontSize: small ? 9 : 10, letterSpacing: '.14em', padding: small ? '4px 10px' : '6px 12px',
    cursor: 'pointer', clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)', fontFamily: fonts.mono }}>
    {children}
  </button>
);

export const inputStyle = {
  background: 'rgba(11,7,22,.85)', border: '1px solid rgba(210,75,255,.35)', color: C.text,
  fontSize: 10, padding: '4px 8px', outline: 'none', letterSpacing: '.05em', fontFamily: fonts.mono,
  colorScheme: 'dark',
};
export const HudInput = (props) => <input {...props} style={{ ...inputStyle, ...props.style }} />;
export const HudSelect = (props) => (
  <select {...props} style={{ ...inputStyle, color: C.cyan, ...props.style }}>{props.children}</select>
);
```

`HeaderTicker.jsx` — implement per design (84 px flex bar, wordmark block, LEVEL + `<Bar pct={xp.pct}/>`, clock via `useEffect` interval + `useState(new Date())`, momentum ring `<svg>` with `strokeDasharray={\`${(momentum / 100) * 113} 113\`}` — 113 ≈ 2π·18, label `{xp.xpIntoLevel} / {xp.xpForNext} XP` or `MAX` when `xpForNext == null`). Buttons call `onOpenSettings` / `onToggleMotion`.

`AgendaStrip.jsx` — filter `agenda.events` by `date === today` sorted by time; upcoming = `date > today`; local state for the quick-add fields; submit → `onAdd({date, time, title, type})`, clear title. Type border colors: `{SCHOOL: C.cyan, INTERVIEW: C.mag, WORK: '#F2EAFF', TRAINING: '#6BFF9E', OTHER: 'rgba(242,234,255,.5)'}`.

- [ ] **Step 4: Run web tests → PASS.** Visual check in dev server against `docs/design/wahnahbe-v2.dc.html` opened side-by-side in a browser.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: header ticker and agenda strip components"
```

---

### Task 12: Status panel (HP/MP, 8-stat list, weigh-in sparkline)

**Files:**
- Create: `web/src/components/StatusPanel.jsx`, `web/src/components/Sparkline.jsx`
- Test: append to `web/test/components.test.jsx`

**Interfaces:**
- `StatusPanel({learning, health, showJp, onGauge, onLogWeighIn})`:
  - HP/MP gauges: click position on the track sets value (`onGauge({hp: pct})` — compute `Math.round(((e.clientX - rect.left) / rect.width) * 100)`), hint line `[SYS] CLICK GAUGE TO SET · HP=PHYSICAL / MP=FOCUS`.
  - CORE STATS: 8 rows from `learning.data.stats` — name (abbreviated label + full name small), `<Bar pct={average/5*100} h={8}/>`, right cell `average.toFixed(1)` or `LV —` for null; status text under bar. If `learning.ok === false` → `[SYS] DATA LINK LOST — REPORT CARD` block instead.
  - WEIGH-IN LOG: latest lbs big cyan, `Δ {(latest - baseline).toFixed(1)} FROM BASELINE`, `<Sparkline points={weighIns}/>`, input + LOG button → `onLogWeighIn(lbs)` (validate float, ignore junk), baseline caption `BASELINE 200.0 · 2026.04.01`.
- `Sparkline({points})` — SVG 130×44 polyline: x spread evenly across up to the last 12 weigh-ins, y scaled min→max (pad 4 px), last point dotted. Pure function of props; exported separately for testing: `sparkPath(points, w, h)` → `{ pts: 'x,y x,y …', last: {x, y} }`.

- [ ] **Step 1: Write the failing test** (append):

```jsx
import { StatusPanel } from '../src/components/StatusPanel.jsx';
import { sparkPath } from '../src/components/Sparkline.jsx';

const learning = { ok: true, data: { stats: [
  { name: 'Conceptual', average: 4.1, status: 'Strong' },
  { name: 'Mathematical', average: 3.0, status: 'Developing' },
  { name: 'Statistical & Data Reasoning', average: 4.7, status: 'Mastery' },
  { name: 'Programming & Implementation', average: 3.3, status: 'Developing' },
  { name: 'Software Eng. & Systems', average: null, status: 'Not yet assessed' },
  { name: 'Applied Problem-Solving', average: 4.0, status: 'Strong' },
  { name: 'Communication & Translation', average: 3.5, status: 'Strong' },
  { name: 'Retention & Connections', average: 3.6, status: 'Strong' },
], totalXp: 249, entries: [] } };

it('StatusPanel renders 8 stats and weigh-in delta', () => {
  const health = { hp: 80, mp: 60, baseline: { date: '2026-04-01', lbs: 200.0 },
    weighIns: [{ date: '2026-04-01', lbs: 200.0 }, { date: '2026-07-01', lbs: 194.6 }] };
  render(<StatusPanel learning={learning} health={health} showJp onGauge={vi.fn()} onLogWeighIn={vi.fn()} />);
  expect(screen.getByText('Conceptual')).toBeTruthy();
  expect(screen.getByText('194.6')).toBeTruthy();
  expect(screen.getByText(/Δ -5.4 FROM BASELINE/)).toBeTruthy();
});

it('StatusPanel degrades when report card unreadable', () => {
  const health = { hp: 80, mp: 60, baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  render(<StatusPanel learning={{ ok: false, error: 'x' }} health={health} showJp onGauge={vi.fn()} onLogWeighIn={vi.fn()} />);
  expect(screen.getByText(/DATA LINK LOST/)).toBeTruthy();
});

it('sparkPath scales points into the viewbox', () => {
  const { pts, last } = sparkPath([{ lbs: 220 }, { lbs: 210 }, { lbs: 215 }], 130, 44);
  expect(pts.split(' ')).toHaveLength(3);
  expect(last.x).toBe(130);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** `Sparkline.jsx`:

```jsx
import React from 'react';
import { C } from '../theme.js';

export function sparkPath(points, w = 130, h = 44) {
  const vals = points.slice(-12).map((p) => p.lbs);
  if (vals.length === 0) return { pts: '', last: null };
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min || 1; const pad = 4;
  const coords = vals.map((v, i) => ({
    x: vals.length === 1 ? w : Math.round((i / (vals.length - 1)) * w),
    y: Math.round(pad + (1 - (v - min) / span) * (h - pad * 2)),
  }));
  return { pts: coords.map((c) => `${c.x},${c.y}`).join(' '), last: coords.at(-1) };
}

export const Sparkline = ({ points }) => {
  const { pts, last } = sparkPath(points);
  return (
    <svg width="130" height="44" viewBox="0 0 130 44" preserveAspectRatio="none"
      style={{ borderBottom: '1px solid rgba(210,75,255,.3)' }}>
      <polyline points={pts} fill="none" stroke={C.cyan} strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 0 3px rgba(63,232,255,.7))' }} />
      {last && <circle cx={last.x} cy={last.y} r="2.5" fill={C.cyan} />}
    </svg>
  );
};
```

`StatusPanel.jsx` — port the design's STATUS column: `panelStyle` wrapper, `SectionTitle SYS://STATUS jp="ステータス"`, gauges (click handler computes pct from `getBoundingClientRect`), stat rows (grid `46px 1fr 46px`; abbreviate names for the left cell with `ABBR = {'Conceptual':'CON','Mathematical':'MATH','Statistical & Data Reasoning':'STAT','Programming & Implementation':'PROG','Software Eng. & Systems':'SWE','Applied Problem-Solving':'APP','Communication & Translation':'COMM','Retention & Connections':'RET'}`), weigh-in block with input state + `onLogWeighIn(parseFloat)` guarded by `Number.isFinite`.

- [ ] **Step 4: Run web tests → PASS.** Visual check vs design.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: status panel - gauges, 8-stat list, weigh-in sparkline"
```

---

### Task 13: Quests panel

**Files:**
- Create: `web/src/components/QuestsPanel.jsx`
- Test: append to `web/test/components.test.jsx`

**Interfaces:**
- `QuestsPanel({quests, today, showJp, onCompleteDaily, onAddSide, onCompleteSide, onDeleteSide, onAddMain, onMainPct})`:
  - **DAILY** — header `QST://DAILY — RESET 00:00` + counter `{doneToday}/{dailies.length}`. Card per daily: title (done → cyan + `[COMPLETE] ✓ XP AWARDED`, else `▸ EXECUTE` button), chip `+{xp} XP → {ABBR[stat] ?? 'GEN'}`. Done = `quests.completions[today]?.includes(id)`.
  - **SIDE** — add row (title input, stat select of the 8 stats + GENERAL, tier select 10/25/50, `+`), list rows with checkbox (done → strikethrough dim title), XP chip, delete ×. Empty state `[NOTIFICATION] No active side quests. Awaiting input.`
  - **MAIN** — add row (title + deadline date + `+`), cards with title, `DL: {deadline || '—'}`, desc, progress `<Bar>` + pct, `<input type="range">` → `onMainPct(id, pct)` on change (fires PATCH on release — use `onMouseUp`/`onTouchEnd` + controlled local value to avoid request spam).

- [ ] **Step 1: Write the failing test** (append):

```jsx
import { QuestsPanel } from '../src/components/QuestsPanel.jsx';

const quests = {
  dailies: [{ id: 'd1', title: 'TRAINING', xp: 15, stat: 'GENERAL' }],
  completions: { '2026-07-11': ['d1'] },
  sides: [{ id: 's1', title: 'SHIP IT', xp: 25, stat: 'Programming & Implementation', done: false, createdAt: 't' }],
  mains: [{ id: 'm1', title: 'RECOMP ARC', desc: 'cut to 200', deadline: '2026-12-31', pct: 30 }],
};

it('QuestsPanel shows completion state, side quests, mains', () => {
  render(<QuestsPanel quests={quests} today="2026-07-11" showJp
    onCompleteDaily={vi.fn()} onAddSide={vi.fn()} onCompleteSide={vi.fn()}
    onDeleteSide={vi.fn()} onAddMain={vi.fn()} onMainPct={vi.fn()} />);
  expect(screen.getByText(/COMPLETE.*XP AWARDED/)).toBeTruthy();  // d1 done today
  expect(screen.getByText('1/1')).toBeTruthy();
  expect(screen.getByText('SHIP IT')).toBeTruthy();
  expect(screen.getByText('RECOMP ARC')).toBeTruthy();
});

it('QuestsPanel EXECUTE fires onCompleteDaily', async () => {
  const on = vi.fn();
  render(<QuestsPanel quests={{ ...quests, completions: {} }} today="2026-07-11" showJp
    onCompleteDaily={on} onAddSide={vi.fn()} onCompleteSide={vi.fn()}
    onDeleteSide={vi.fn()} onAddMain={vi.fn()} onMainPct={vi.fn()} />);
  screen.getByText(/EXECUTE/).click();
  expect(on).toHaveBeenCalledWith('d1');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `QuestsPanel.jsx` porting the design's QUESTS column markup (three sections with gradient dividers, quest cards with `clip(8)`-style corners, `▸ EXECUTE` button style from design). Use `bits.jsx` primitives. Local state: side-quest add fields, main-quest add fields, per-main local slider values (`useState({})`, commit on mouse-up).

- [ ] **Step 4: Run web tests → PASS.** Visual check vs design.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: quests panel - dailies, side quests, main quest arcs"
```

---

### Task 14: Skills panel (octagon radar, training logger, LANG card, learning feed)

**Files:**
- Create: `web/src/components/SkillsPanel.jsx`, `web/src/components/Radar.jsx`
- Test: append to `web/test/components.test.jsx`

**Interfaces:**
- `radarPoints(stats, cx, cy, r)` (exported from `Radar.jsx`) → SVG points string; 8 axes at 45° steps starting straight up; radius scaled `average/5 × r`, `null` → 0.06 × r (visible dot near center).
- `Radar({stats})` — 260×260 SVG: 3 concentric octagon grid rings (r, 2r/3, r/3), 8 spokes, filled data polygon (`rgba(210,75,255,.22)` fill, cyan stroke + glow), axis labels = ABBR names with `average` (e.g. `STAT 4.7`), null shown as `—`.
- `SkillsPanel({learning, tutor, japanese, showJp, onTrain})`:
  - Radar (degrades with `[SYS] DATA LINK LOST — REPORT CARD` if `!learning.ok`).
  - `SKL://LOG_TRAINING` box: stat select (8 + GENERAL), S/M/L buttons → `onTrain(stat, 10|20|40)`; caption `S +10 / M +20 / L +40 XP`.
  - `LANG://日本語` card: level badge (`N5`), `STREAK {n}d`, `COMP {Math.round(rollingAvg*100)}%`, `LAST {lastSession}`; if last session > 14 days ago add `[SYS] SIGNAL FADING — RESUME TRAINING` in dim cyan; degrades if `!japanese.ok`.
  - `SYS://RECENT_SYNC` feed: latest 5 `activity` log titles (`{date} · {kind.toUpperCase()} · {title}`, truncate title 60 chars) + latest 3 gradebook grades (`{concept} · {pct}%`); each degrades independently.
  - Note: `activity` passed via `tutor` prop? No — keep explicit: `SkillsPanel({learning, tutor, activity, japanese, showJp, onTrain})`.

- [ ] **Step 1: Write the failing test** (append):

```jsx
import { SkillsPanel } from '../src/components/SkillsPanel.jsx';
import { radarPoints } from '../src/components/Radar.jsx';

it('radarPoints maps 8 averages to 8 svg points', () => {
  const stats = Array.from({ length: 8 }, (_, i) => ({ name: `s${i}`, average: 5, status: '' }));
  const pts = radarPoints(stats, 130, 120, 90).split(' ');
  expect(pts).toHaveLength(8);
  expect(pts[0]).toBe('130,30'); // straight up at full radius
});

it('SkillsPanel renders LANG card and feed', () => {
  render(<SkillsPanel learning={learning} activity={{ ok: true, data: [{ date: '2026-07-10', kind: 'teach', title: 'FE lesson' }] }}
    tutor={{ gradebook: { ok: true, data: [{ date: '2026-06-24', concept: 'Error term', pct: 78 }] }, mastery: { ok: true, data: { bands: { solid: 1, forming: 2, shaky: 1 }, total: 4 } } }}
    japanese={{ ok: true, data: { level: 'N5', streak: 14, rollingAvg: 0.9, lastSession: '2026-06-11', paused: false } }}
    showJp onTrain={vi.fn()} />);
  expect(screen.getByText('N5')).toBeTruthy();
  expect(screen.getByText(/STREAK 14/)).toBeTruthy();
  expect(screen.getByText(/FE lesson/)).toBeTruthy();
  expect(screen.getByText(/SIGNAL FADING/)).toBeTruthy(); // 2026-06-11 is >14d before now (test uses real now: guard with vi.setSystemTime)
});
```

Use `vi.setSystemTime(new Date('2026-07-11'))` in a `beforeEach` for the staleness assertion.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`Radar.jsx`:
```jsx
import React from 'react';
import { C, fonts } from '../theme.js';

const ANGLES = Array.from({ length: 8 }, (_, i) => (Math.PI * 2 * i) / 8 - Math.PI / 2);

export function radarPoints(stats, cx, cy, r) {
  return stats.map((s, i) => {
    const frac = s.average == null ? 0.06 : s.average / 5;
    const x = +(cx + Math.cos(ANGLES[i]) * r * frac).toFixed(1);
    const y = +(cy + Math.sin(ANGLES[i]) * r * frac).toFixed(1);
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }).join(' ');
}

const ring = (cx, cy, r) => ANGLES.map((a) =>
  `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`).join(' ');

export const ABBR = {
  'Conceptual': 'CON', 'Mathematical': 'MATH', 'Statistical & Data Reasoning': 'STAT',
  'Programming & Implementation': 'PROG', 'Software Eng. & Systems': 'SWE',
  'Applied Problem-Solving': 'APP', 'Communication & Translation': 'COMM',
  'Retention & Connections': 'RET', GENERAL: 'GEN',
};

export const Radar = ({ stats }) => {
  const cx = 130; const cy = 128; const r = 88;
  return (
    <svg width="100%" viewBox="0 0 260 256" style={{ flex: 'none' }}>
      {[r, (r * 2) / 3, r / 3].map((rr) => (
        <polygon key={rr} points={ring(cx, cy, rr)} fill="none" stroke="rgba(210,75,255,.25)" strokeWidth="1" />
      ))}
      {ANGLES.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="rgba(210,75,255,.12)" />
      ))}
      <polygon points={radarPoints(stats, cx, cy, r)} fill="rgba(210,75,255,.22)" stroke={C.cyan}
        strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px rgba(63,232,255,.6))' }} />
      {stats.map((s, i) => {
        const lx = cx + Math.cos(ANGLES[i]) * (r + 16);
        const ly = cy + Math.sin(ANGLES[i]) * (r + 16) + 3;
        return (
          <text key={s.name} x={lx} y={ly} textAnchor="middle" fill={C.cyan} fontSize="9" fontFamily={fonts.mono}>
            {ABBR[s.name]} {s.average == null ? '—' : s.average}
          </text>
        );
      })}
    </svg>
  );
};
```

`SkillsPanel.jsx` — assemble per interface above using `bits.jsx` primitives and design styling; staleness = `(Date.now() - new Date(lastSession)) / 86400000 > 14`.

- [ ] **Step 4: Run web tests → PASS.** Visual check.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: skills panel - octagon radar, training logger, LANG card, sync feed"
```

---

### Task 15: Overlays (boot, notification, ascension), settings drawer, full App assembly

**Files:**
- Create: `web/src/components/BootSequence.jsx`, `web/src/components/Notification.jsx`, `web/src/components/AscensionOverlay.jsx`, `web/src/components/SettingsDrawer.jsx`
- Modify: `web/src/App.jsx` (full assembly)
- Test: append to `web/test/components.test.jsx` (App smoke with mocked fetch/EventSource)

**Interfaces:**
- `BootSequence({onDone})` — fixed overlay, types 4 lines (`[SYS] WAHNAHBE KERNEL v2.0`, `[SYS] LINKING SECOND-BRAIN VAULT…`, `[SYS] PARSING OPERATIVE RECORD…`, `[SYS] ALL SYSTEMS NOMINAL`) at 450 ms intervals with progress bar, then fades (design `bootOut` animation) and calls `onDone`; click skips immediately. Skipped entirely when `settings.reducedMotion`.
- `Notification({note})` — design's notification window; `note = {lines: string[]} | null`; auto-shown while non-null.
- `AscensionOverlay({level, onClose})` — design's full-screen `LEVEL UP — {level}` overlay, click to dismiss.
- `SettingsDrawer({open, settings, quests, health, onClose, onSaveSettings, onSaveDailies, onDeleteWeighIn, onExport, onImport})` — right drawer per design: title input; daily quest editor (rows: title / xp / stat select / ×, `+ ADD` appends a blank row; SAVE button commits via `onSaveDailies`); weigh-in list with per-date delete; DATA//PERSISTENCE: EXPORT JSON (downloads `wahnahbe-export.json` = full dashboard `data` via `URL.createObjectURL`), IMPORT JSON (file input → parse → POSTs each state slice via provided `onImport(parsed)`); toggles for scanlines/jpLabels/reducedMotion (checkbox rows → `onSaveSettings`).
- `App` — composition: `useDashboard()`; local ui state `{booted, settingsOpen, note, ascendLevel}`. Action helpers wrap `act(...)` in try/catch → failures become `note = {lines: ['[SYS] ERROR', message]}` (auto-clear 4 s). Successful daily/side/training awards → `note` with `+N XP` lines (auto-clear 3 s); `award.ascended` → `ascendLevel`. Notification auto-clear via `useEffect` timeout. Grid layout `335px 1fr 355px` per design; scanline overlay when `settings.scanlines`; `data-rm` reduced-motion attribute per design (`[data-rm="1"] * {animation:none}` style already in index.html).
- Training action: `onTrain(stat, amount)` → `act('POST', '/xp/award', { amount, stat, reason: 'TRAINING SESSION', source: 'training' })`.

- [ ] **Step 1: Write the failing App smoke test** (append):

```jsx
import App from '../src/App.jsx';

function mockBackend(data) {
  global.EventSource = class { addEventListener() {} close() {} };
  global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data }) });
}

it('App renders all panels from dashboard data (boot skipped via reducedMotion)', async () => {
  mockBackend({
    learning, // from earlier in file
    japanese: { ok: true, data: { level: 'N5', streak: 14, rollingAvg: 0.9, lastSession: '2026-06-11', paused: false } },
    activity: { ok: true, data: [] },
    tutor: { gradebook: { ok: true, data: [] }, mastery: { ok: true, data: { bands: { solid: 0, forming: 0, shaky: 0 }, total: 0 } } },
    quests: { dailies: [], completions: {}, sides: [], mains: [] },
    health: { hp: 100, mp: 100, baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] },
    agenda: { events: [] },
    settings: { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: true },
    xp: { total: 249, reportXp: 249, ledgerXp: 0, level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 },
    momentum: 0, today: '2026-07-11',
  });
  render(<App />);
  expect(await screen.findByText('WAHNAHBE')).toBeTruthy();
  expect(screen.getByText('SYS://STATUS')).toBeTruthy();
  expect(screen.getByText('QST://QUESTS')).toBeTruthy();
  expect(screen.getByText('SKL://SKILLS')).toBeTruthy();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** the four overlay components + full `App.jsx`, porting overlay markup from the design's NOTIFICATION / ASCEND / BOOT / SETTINGS sections. App skeleton:

```jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useDashboard } from './hooks/useDashboard.js';
import { C, fonts } from './theme.js';
import { HeaderTicker } from './components/HeaderTicker.jsx';
import { AgendaStrip } from './components/AgendaStrip.jsx';
import { StatusPanel } from './components/StatusPanel.jsx';
import { QuestsPanel } from './components/QuestsPanel.jsx';
import { SkillsPanel } from './components/SkillsPanel.jsx';
import { BootSequence } from './components/BootSequence.jsx';
import { Notification } from './components/Notification.jsx';
import { AscensionOverlay } from './components/AscensionOverlay.jsx';
import { SettingsDrawer } from './components/SettingsDrawer.jsx';

export default function App() {
  const { data, error, act } = useDashboard();
  const [booted, setBooted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [ascendLevel, setAscendLevel] = useState(null);

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);

  const run = useCallback(async (method, path, body, successLines) => {
    try {
      const result = await act(method, path, body);
      if (result?.award) {
        setNote({ lines: successLines ?? [`+${body?.amount ?? result.award.total} XP BANKED`] });
        if (result.award.ascended) setAscendLevel(result.award.ascended);
      } else if (successLines) setNote({ lines: successLines });
      return result;
    } catch (e) {
      setNote({ lines: ['[SYS] ERROR', e.message] });
      return null;
    }
  }, [act]);

  if (!data) {
    return <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: fonts.mono, padding: 24 }}>
      {error ? `[SYS] LINK ERROR: ${error}` : '[SYS] CONNECTING…'}</div>;
  }
  const { settings } = data;
  const rm = settings.reducedMotion;

  return (
    <div data-rm={rm ? '1' : '0'} style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden',
      background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(60,25,100,.55), rgba(8,5,15,0) 60%), ${C.bg}`,
      color: C.text, fontFamily: fonts.mono }}>
      {settings.scanlines && <div style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, rgba(63,232,255,.022) 0 1px, transparent 1px 3px)' }} />}
      <HeaderTicker xp={data.xp} momentum={data.momentum} settings={settings} learning={data.learning}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleMotion={() => run('PUT', '/settings', { ...settings, reducedMotion: !rm })} />
      <AgendaStrip agenda={data.agenda} today={data.today}
        onAdd={(ev) => run('POST', '/agenda', ev)}
        onDelete={(id) => run('DELETE', `/agenda/${id}`)} />
      <div style={{ display: 'grid', gridTemplateColumns: '335px 1fr 355px', gap: 14, padding: 14,
        height: 'calc(100vh - 176px)', boxSizing: 'border-box' }}>
        <StatusPanel learning={data.learning} health={data.health} showJp={settings.jpLabels}
          onGauge={(g) => run('POST', '/health/gauge', g)}
          onLogWeighIn={(lbs) => run('POST', '/health/weighins', { lbs }, ['[SYS] WEIGH-IN LOGGED'])} />
        <QuestsPanel quests={data.quests} today={data.today} showJp={settings.jpLabels}
          onCompleteDaily={(id) => run('POST', `/quests/daily/${id}/complete`)}
          onAddSide={(s) => run('POST', '/quests/side', s)}
          onCompleteSide={(id) => run('POST', `/quests/side/${id}/complete`)}
          onDeleteSide={(id) => run('DELETE', `/quests/side/${id}`)}
          onAddMain={(m) => run('POST', '/quests/main', m)}
          onMainPct={(id, pct) => run('PATCH', `/quests/main/${id}`, { pct })} />
        <SkillsPanel learning={data.learning} tutor={data.tutor} activity={data.activity}
          japanese={data.japanese} showJp={settings.jpLabels}
          onTrain={(stat, amount) => run('POST', '/xp/award',
            { amount, stat, reason: 'TRAINING SESSION', source: 'training' })} />
      </div>
      <Notification note={note} />
      {ascendLevel && <AscensionOverlay level={ascendLevel} onClose={() => setAscendLevel(null)} />}
      {!booted && !rm && <BootSequence onDone={() => setBooted(true)} />}
      <SettingsDrawer open={settingsOpen} settings={settings} quests={data.quests} health={data.health}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={(s) => run('PUT', '/settings', s, ['[SYS] CONFIG SAVED'])}
        onSaveDailies={(dailies) => run('PUT', '/quests/dailies', { dailies }, ['[SYS] DAILY TARGETS UPDATED'])}
        onDeleteWeighIn={(date) => run('DELETE', `/health/weighins/${date}`)}
        fullData={data} />
    </div>
  );
}
```

(SettingsDrawer receives `fullData` for EXPORT JSON; IMPORT reads the file, validates it has the five state keys, then sequentially `run`s `PUT /settings`, `PUT /quests/dailies`, and posts weigh-ins/agenda items not already present — document in a code comment that import is additive, not destructive.)

- [ ] **Step 4: Run web tests → PASS.** Full visual pass in dev against `docs/design/wahnahbe-v2.dc.html`; fix styling drift.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: overlays, settings drawer, full app assembly"
```

---

### Task 16: Production serving + build

**Files:**
- Modify: `server/app.js` (static serving), root `package.json` (verify scripts)
- Test: `server/test/static.test.js`

**Interfaces:**
- `createApp(config, bus)` additionally serves `web/dist` statically with an SPA fallback (`GET` non-`/api` routes → `index.html`) **only when the dist folder exists**; API routes keep priority.

- [ ] **Step 1: Write the failing test**

`server/test/static.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

it('serves index.html for non-api routes when dist exists', async () => {
  const env = makeFixtureEnv();
  const dist = path.join(env.root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>WAHNAHBE SYSTEM</title>');
  const app = createApp({ ...env.config, webDist: dist });
  expect((await request(app).get('/')).text).toContain('WAHNAHBE');
  expect((await request(app).get('/api/dashboard')).body.ok).toBe(true);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** in `server/app.js` (after API mounts):

```js
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
// inside createApp:
  const dist = config.webDist ?? path.join(import.meta.dirname, '..', 'web', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
```

(`config.webDist` is a test seam only; `loadConfig` doesn't need to know about it.)

- [ ] **Step 4: Run all tests → PASS. Full production smoke:** `npm run build && npm start`, open `http://localhost:4777` in a browser — full dashboard on real vault data. Stop server.

- [ ] **Step 5: Commit**

```bash
git add server package.json
git commit -m "feat: production static serving with SPA fallback"
```

---

### Task 17: E2E smoke (Playwright)

**Files:**
- Create: `e2e/playwright.config.js`, `e2e/global-setup.js`, `e2e/smoke.spec.js`, `e2e/package.json`
- Modify: root `package.json` (add `"e2e": "npm run build && npx playwright test -c e2e"` script; add `e2e` to workspaces)

**Interfaces:**
- Global setup creates a fixture vault (same layout as `makeFixtureEnv` but standalone — copies `server/test/fixtures` into a temp dir recorded in `process.env`), launches the production server as a child process with `WAHNAHBE_VAULT`/`WAHNAHBE_JP_VAULT` env pointing at it on port 4778.

- [ ] **Step 1: Write config + setup**

`e2e/package.json`:
```json
{ "name": "@thesystem/e2e", "type": "module", "devDependencies": { "@playwright/test": "^1.46.0" } }
```

`e2e/global-setup.js`:
```js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default async function globalSetup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-e2e-'));
  const fx = path.resolve('server/test/fixtures');
  const put = (rel, f) => {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(fx, f), dest);
  };
  put('second-brain/wiki/syntheses/learning-report-card.md', 'learning-report-card.md');
  put('second-brain/tutor/gradebook.md', 'gradebook.md');
  put('second-brain/tutor/concept-mastery.md', 'concept-mastery.md');
  put('second-brain/wiki/log.md', 'log.md');
  put('japanesetutor/progress.md', 'progress.md');
  const server = spawn('node', ['server/index.js'], {
    env: { ...process.env,
      WAHNAHBE_VAULT: path.join(root, 'second-brain'),
      WAHNAHBE_JP_VAULT: path.join(root, 'japanesetutor'),
      WAHNAHBE_PORT: '4778' },
    stdio: 'inherit',
  });
  await new Promise((r) => setTimeout(r, 1500));
  process.env.E2E_ROOT = root;
  return () => server.kill();
}
```

`e2e/playwright.config.js`:
```js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.js',
  use: { baseURL: 'http://localhost:4778' },
});
```

- [ ] **Step 2: Write the smoke spec**

`e2e/smoke.spec.js`:
```js
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('boots, renders real data, completes a daily, live-updates on vault edit', async ({ page }) => {
  await page.goto('/');
  await page.click('body'); // skip boot sequence
  await expect(page.getByText('WAHNAHBE')).toBeVisible();
  await expect(page.getByText('249', { exact: false }).first()).toBeVisible();

  // Complete a daily → XP notification
  await page.getByText('▸ EXECUTE').first().click();
  await expect(page.getByText(/XP/).first()).toBeVisible();
  await expect(page.getByText('[COMPLETE] ✓ XP AWARDED').first()).toBeVisible();

  // Edit the JP vault file on disk → LANG card live-updates via SSE
  const jp = path.join(process.env.E2E_ROOT, 'japanesetutor', 'progress.md');
  fs.writeFileSync(jp, fs.readFileSync(jp, 'utf8').replace('streak: 14', 'streak: 99'));
  await expect(page.getByText(/STREAK 99/)).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 3: Run** `npm install && npx playwright install chromium`, then `npm run e2e` → all assertions pass. If the SSE assertion flakes, bump watcher debounce assertion timeout (not the debounce itself).

- [ ] **Step 4: Commit**

```bash
git add e2e package.json
git commit -m "test: playwright e2e smoke - render, quest completion, live vault updates"
```

---

### Task 18: Claude skills + project CLAUDE.md

**Files:**
- Create: `.claude/skills/sync-calendar/SKILL.md`, `.claude/skills/award/SKILL.md`, `.claude/skills/system-restart/SKILL.md`, `CLAUDE.md`

- [ ] **Step 1: Write `.claude/skills/sync-calendar/SKILL.md`**

```markdown
---
name: sync-calendar
description: Pull the next 7 days of Google Calendar events into the Wahnahbe dashboard agenda. Use when Josh says "sync my calendar", "update my agenda", or similar.
---

# Sync Calendar → Dashboard Agenda

1. Read `C:\Users\gjgut\second-brain\system\agenda.json` (schema: `{events: [{id, date, time, title, type, source, gcalId?}]}`).
2. List Google Calendar events for today through today+7 using the calendar MCP tools (`list_events`). If the calendar MCP is not connected, STOP and tell Josh to authorize it — do not fabricate events.
3. Merge, never duplicate:
   - Match existing events by `gcalId`. Update `date`/`time`/`title` in place if changed on the calendar side.
   - New calendar events → append `{id: <new uuid>, date: "YYYY-MM-DD", time: "HH:MM" (24h, event start, local), title: <summary uppercased>, type: <best fit of SCHOOL|INTERVIEW|WORK|TRAINING|OTHER>, source: "gcal", gcalId: <event id>}`.
   - Events with `source: "gcal"` whose `gcalId` no longer exists in the calendar window → remove.
   - NEVER touch events with `source: "manual"`.
4. Write the full updated JSON back (2-space indent). The dashboard picks it up automatically.
5. Report: N added, N updated, N removed.
```

- [ ] **Step 2: Write `.claude/skills/award/SKILL.md`**

```markdown
---
name: award
description: Bank XP to the Wahnahbe dashboard ledger when Josh learns or accomplishes something in a session. Use when Josh says "award XP", "log that", "bank it", or you finish teaching him something substantial outside the vault tutoring flow.
---

# Award XP → Dashboard Ledger

Preferred (server running): POST http://localhost:4777/api/xp/award with JSON
`{"amount": <int 1-500>, "stat": <one of: Conceptual | Mathematical | Statistical & Data Reasoning | Programming & Implementation | Software Eng. & Systems | Applied Problem-Solving | Communication & Translation | Retention & Connections | GENERAL>, "reason": "<one line>", "source": "claude-session"}`

Fallback (server down): edit `C:\Users\gjgut\second-brain\system\xpLedger.json` directly — append to `entries`: `{"ts": "<ISO now>", "amount": N, "stat": "...", "reason": "...", "source": "claude-session"}`. Do NOT edit `crossings` by hand.

Guidance: S/M/L session ≈ 10/20/40 XP. Match the report card's spirit — XP is mileage, not mastery. Never award for trivia.
```

- [ ] **Step 3: Write `.claude/skills/system-restart/SKILL.md`**

```markdown
---
name: system-restart
description: Rebuild the Wahnahbe dashboard frontend and restart the auto-start server. Use after changing dashboard code, or when Josh says the dashboard looks stale or broken.
---

# System Restart

From `C:\Users\gjgut\codingprojects\THESYSTEM`:

1. `npm run build` — must succeed; if it fails, fix the build, don't restart.
2. `schtasks /End /TN "WahnahbeSystem"` then `schtasks /Run /TN "WahnahbeSystem"`.
3. If the task doesn't exist (first setup): `powershell -File scripts\install-autostart.ps1`.
4. Verify: `curl http://localhost:4777/api/dashboard` returns `{"ok":true`. Check `logs\server.log` tail on failure.
```

- [ ] **Step 4: Write `CLAUDE.md`** — project doc for future sessions:

```markdown
# THESYSTEM — Wahnahbe Dashboard

Life-RPG dashboard on http://localhost:4777 (auto-starts at logon via Task Scheduler task "WahnahbeSystem").
Spec: docs/superpowers/specs/2026-07-11-wahnahbe-dashboard-design.md. Visual reference: docs/design/wahnahbe-v2.dc.html.

## Golden rules
- Files are the API. Dashboard state lives in `C:\Users\gjgut\second-brain\system\*.json` — any session may edit those (atomically, schema-shapes below). The dashboard live-reloads via file watcher.
- NEVER write to the vault's learning files (report card, gradebook, concept-mastery, wiki log, JP progress.md) on behalf of the dashboard — the vault owns those; the dashboard only reads them.
- Total XP = report-card XP + xpLedger sum. Ledger entries are append-only.
- After changing dashboard code: use the system-restart skill (rebuild + bounce).

## State file shapes (second-brain/system/)
- quests.json: {dailies:[{id,title,xp,stat}], completions:{"YYYY-MM-DD":[ids]}, sides:[{id,title,xp,stat,done,createdAt}], mains:[{id,title,desc,deadline,pct}]}
- health.json: {hp,mp,baseline:{date,lbs},weighIns:[{date,lbs}]}
- agenda.json: {events:[{id,date,time,title,type,source,gcalId?}]} — types SCHOOL|INTERVIEW|WORK|TRAINING|OTHER; source manual|gcal
- xpLedger.json: {entries:[{ts,amount,stat,reason,source}], crossings:[{level,ts}]}
- settings.json: {title,scanlines,jpLabels,reducedMotion}
- `stat` values: the 8 report-card stat names verbatim, or GENERAL.

## Dev
- `npm run dev` (server, :4777) + `npm run dev --workspace=web` (Vite, :5173). Tests: `npm test`. E2E: `npm run e2e`.
```

- [ ] **Step 5: Commit**

```bash
git add .claude CLAUDE.md
git commit -m "feat: claude skills (sync-calendar, award, system-restart) and project CLAUDE.md"
```

---

### Task 19: Auto-start on boot (Task Scheduler)

**Files:**
- Create: `scripts/install-autostart.ps1`, `scripts/start-server.vbs`

- [ ] **Step 1: Write `scripts/start-server.vbs`** (hidden-window launcher — schtasks alone flashes a console):

```vb
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\gjgut\codingprojects\THESYSTEM"
shell.Run "cmd /c npm start >> logs\autostart.log 2>&1", 0, False
```

- [ ] **Step 2: Write `scripts/install-autostart.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force (Join-Path $repo 'logs') | Out-Null

$action = New-ScheduledTaskAction -Execute 'wscript.exe' `
  -Argument ('"{0}"' -f (Join-Path $repo 'scripts\start-server.vbs'))
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)

Register-ScheduledTask -TaskName 'WahnahbeSystem' -Action $action -Trigger $trigger `
  -Settings $settings -Description 'Wahnahbe System dashboard server (localhost:4777)' -Force
Write-Host 'Installed. Starting now…'
Start-ScheduledTask -TaskName 'WahnahbeSystem'
```

- [ ] **Step 3: Install and verify**

Run: `npm run build`, then `powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1`.
Verify: `Get-ScheduledTask WahnahbeSystem` shows Ready/Running; `curl http://localhost:4777/api/dashboard` returns `{"ok":true…}`; `logs\server.log` has the online line. Then open `http://localhost:4777` — full dashboard on real vault data.

- [ ] **Step 4: Reboot-equivalent check** — `schtasks /End /TN WahnahbeSystem; schtasks /Run /TN WahnahbeSystem`, confirm the API answers again within ~5 s.

- [ ] **Step 5: Commit**

```bash
git add scripts
git commit -m "feat: task scheduler auto-start with hidden window and restart-on-failure"
```

---

### Task 20: Real-data seeding + final verification

**Files:**
- Modify: `C:\Users\gjgut\second-brain\system\*.json` (live data, not committed — outside repo)

- [ ] **Step 1: Seed Josh's real starting state** via the running API (or direct file edits): set `settings.title` (ask Josh — default `DATA OPERATIVE`), confirm the three default dailies with him or replace via the settings drawer, add current main quests (at minimum: BU coursework arc, recomp arc — confirm wording with Josh).

- [ ] **Step 2: Full acceptance pass against the spec** — walk every §5 UI element on real data: header numbers match the report card (249 XP / Level 4), octagon matches the averages table (4.1/3.0/4.7/3.3/—/4.0/3.5/3.6), LANG card matches progress.md (N5, streak 14), weigh-in shows 200.0 baseline; complete a daily → notification + ledger entry lands in `xpLedger.json`; delete it back if Josh wants a clean slate.

- [ ] **Step 3: Live-update proof** — while the dashboard is open, append a test line to `wiki/log.md`, watch the feed refresh, then remove the line.

- [ ] **Step 4: Run the whole suite one last time** — `npm test && npm run e2e` → all green.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final acceptance pass"
```

---

## Self-Review (completed)

- **Spec coverage:** §2 architecture → Tasks 1, 6, 9, 16; §3.1 sources/parsers → Tasks 3–4; §3.2 state files → Task 2; §4 XP/stats → Tasks 5, 7, 8; §5 UI → Tasks 10–15; §6 skills/CLAUDE.md → Task 18; §7 autostart → Task 19; §8 error handling → Tasks 2, 6 (degradation), 8 (validation), 9 (fatal logging); §9 testing → every task + Task 17 E2E. Export/import JSON (spec §5 settings drawer) → Task 15 SettingsDrawer.
- **Placeholder scan:** all steps carry code or exact commands; visual fine-tuning steps reference the in-repo design file, which is data, not a TBD.
- **Type consistency:** `readStateFile/writeStateFile(stateDir, name)` used identically in Tasks 2, 6–9; `awardXp` return `{ledger, total, xp, ascended}` consumed by Tasks 7, 8, 10 (App merges `award.total`/`award.xp`); stat names verbatim-identical across schemas (Task 2), ABBR map (Tasks 12, 14), and skills docs (Task 18); envelope `{ok, data|error}` uniform.
```
