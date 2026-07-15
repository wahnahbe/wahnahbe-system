# Uncapped Levels + Rank FX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the level-5 cap (named ranks to 10, procedural ★ tiers forever) and make each rank unlock premium page-level visual effects (GSAP + OGL), with rank insignia/accents and an orchestrated ascension moment.

**Architecture:** Server gains a `thresholdFor(level)` generator shared by `levelInfo` and `newCrossings` so the ladder is infinite and internally consistent. Web gains `rankTheme.js` (pure rank→visuals lookup), `useRankFx` (gated dynamic-importer of `web/src/fx/*` modules), and a GSAP master timeline for ascension. FX are lazy-loaded, tab-aware, and disabled by reduced-motion or the new `fxRank` setting.

**Tech Stack:** Existing (React 18, Vite 5, Express 4, zod, vitest, Playwright) + `gsap` ^3.13 (all plugins free) + `ogl` (WebGL, lazy-loaded at rank 10 only).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-uncapped-levels-rank-fx-design.md` — its ladder table, FX table, and gating rules are binding verbatim.
- Named thresholds: 0/40/120/240/400/560/760/1000/1300/1650; level 11 (`Monarch ★2`) at 2100; widths past 10: `w = Math.round(w * 1.28 / 10) * 10` starting from 450. Names past 10: `Monarch ★{level-9}`.
- `levelInfo` NEVER returns null `xpForNext` or a MAX state. `thresholdFor` is the single source of truth for both `levelInfo` and `newCrossings`.
- FX gating: nothing mounts when `settings.reducedMotion === true` OR `settings.fxRank === false`. Settings schema uses `.default(true)` for `fxRank` (live settings.json lacks the key — must still parse).
- FX modules: `web/src/fx/<name>.js` exporting `mount(ctx)` / `unmount()`; dynamically imported only when unlocked. Canvas/WebGL pause on `visibilitychange`. Aurora renders at half resolution.
- Accent/insignia changes touch ONLY the header level block + ascension overlay.
- Route handlers stay synchronous; envelope `{ok,data}`; immutability; vault read-only. Conventional commits. TDD.
- E2E runs from an isolated git worktree (CLAUDE.md dev note) — never in-place while the live server runs.
- E2E fixture stays at 249 XP (level 4) so `decode` (level 5) can't race text assertions.

## File Structure

```
server/xp.js                     # ladder rewrite: NAMED_LEVELS, thresholdFor, levelInfo, newCrossings
web/src/rankTheme.js             # rank → {name, accent, fx[]} lookup (mirrors server names)
web/src/components/RankInsignia.jsx  # SVG insignia per rank (+ star badge)
web/src/hooks/useRankFx.js       # gated dynamic importer / lifecycle
web/src/fx/panelFocus.js …aurora.js  # nine effect modules
web/src/components/HeaderTicker.jsx  # insignia + accent integration
web/src/components/AscensionOverlay.jsx  # GSAP master timeline rework
web/src/components/SettingsDrawer.jsx    # FX://RANK toggle
server/state/schemas.js          # settings.fxRank default(true)
```

---

### Task 1: Server — uncapped ladder

**Files:**
- Modify: `server/xp.js`
- Test: `server/test/xp.test.js` (update MAX-branch tests, add boundary/procedural tests)

**Interfaces:**
- Produces: `NAMED_LEVELS` (array of `{level, name, min}`, 10 entries, exported; `LEVELS` export REMOVED — update the two test imports), `thresholdFor(level: int ≥ 1) → number` (min XP of that level), `levelInfo(xp) → {level, name, xpIntoLevel, xpForNext, pct}` (xpForNext always a number = current level width), `newCrossings(prevXp, nextXp, ledger) → number[]` (unchanged signature, now unbounded).
- Consumes: nothing new. `awards.js` and `dashboard.js` keep working unchanged (same call signatures).

- [ ] **Step 1: Write the failing tests** — replace the old `levelInfo(450) MAX` test and `LEVELS` table test in `server/test/xp.test.js` with:

```js
import { NAMED_LEVELS, thresholdFor, totalXp, levelInfo, newCrossings, momentum, localDateStr } from '../xp.js';

it('named ladder mirrors the spec table', () => {
  expect(NAMED_LEVELS.map((l) => l.min)).toEqual([0, 40, 120, 240, 400, 560, 760, 1000, 1300, 1650]);
  expect(NAMED_LEVELS[5].name).toBe('Architect');
  expect(NAMED_LEVELS[9].name).toBe('Monarch');
});

it('thresholdFor generates procedural tiers past 10', () => {
  expect(thresholdFor(10)).toBe(1650);
  expect(thresholdFor(11)).toBe(2100);          // 1650 + 450
  expect(thresholdFor(12)).toBe(2100 + 580);    // round(450*1.28/10)*10 = 580
  expect(thresholdFor(13)).toBe(2680 + 740);    // round(580*1.28/10)*10 = 740
});

it('levelInfo has no MAX state and names star tiers', () => {
  expect(levelInfo(454)).toEqual({ level: 5, name: 'Forward-Deployed Master', xpIntoLevel: 54, xpForNext: 160, pct: 34 });
  expect(levelInfo(559).level).toBe(5);
  expect(levelInfo(560)).toMatchObject({ level: 6, name: 'Architect' });
  expect(levelInfo(1650)).toMatchObject({ level: 10, name: 'Monarch' });
  expect(levelInfo(2100)).toMatchObject({ level: 11, name: 'Monarch ★2', xpForNext: 580 });
  expect(levelInfo(2099)).toMatchObject({ level: 10, xpForNext: 450 });
});

it('newCrossings works across procedural thresholds', () => {
  const empty = { entries: [], crossings: [] };
  expect(newCrossings(2050, 2150, empty)).toEqual([11]);
  expect(newCrossings(390, 620, empty)).toEqual([5, 6]);
  expect(newCrossings(2050, 2150, { entries: [], crossings: [{ level: 11, ts: 't' }] })).toEqual([]);
});
```

Keep the existing totalXp/momentum/localDateStr/clamp tests; update the negative-clamp expectation (`levelInfo(-50)` → same result as before but `xpForNext: 40`).

- [ ] **Step 2: Run** `npx vitest run --root server xp` — new tests FAIL (LEVELS still capped).

- [ ] **Step 3: Implement** in `server/xp.js`:

```js
export const NAMED_LEVELS = [
  { level: 1, name: 'Apprentice', min: 0 },
  { level: 2, name: 'Practitioner', min: 40 },
  { level: 3, name: 'Analyst', min: 120 },
  { level: 4, name: 'Engineer', min: 240 },
  { level: 5, name: 'Forward-Deployed Master', min: 400 },
  { level: 6, name: 'Architect', min: 560 },
  { level: 7, name: 'Netrunner', min: 760 },
  { level: 8, name: 'Ghost', min: 1000 },
  { level: 9, name: 'Sovereign', min: 1300 },
  { level: 10, name: 'Monarch', min: 1650 },
];
const LAST_NAMED_WIDTH = 450; // width of level 10 → 11
const STAR_GROWTH = 1.28;

export function thresholdFor(level) {
  if (level <= 10) return NAMED_LEVELS[level - 1].min;
  let min = NAMED_LEVELS[9].min;
  let width = LAST_NAMED_WIDTH;
  for (let l = 11; l <= level; l += 1) {
    min += width;
    width = Math.round((width * STAR_GROWTH) / 10) * 10;
  }
  return min;
}

export function levelNameFor(level) {
  return level <= 10 ? NAMED_LEVELS[level - 1].name : `Monarch ★${level - 9}`;
}

export function levelInfo(xp) {
  const clamped = Math.max(0, xp);
  let level = 1;
  while (clamped >= thresholdFor(level + 1)) level += 1;
  const min = thresholdFor(level);
  const xpForNext = thresholdFor(level + 1) - min;
  const xpIntoLevel = clamped - min;
  return { level, name: levelNameFor(level), xpIntoLevel, xpForNext, pct: Math.round((xpIntoLevel / xpForNext) * 100) };
}

export function newCrossings(prevXp, nextXp, ledger) {
  const recorded = new Set(ledger.crossings.map((c) => c.level));
  const out = [];
  for (let l = levelInfo(prevXp).level + 1; l <= levelInfo(nextXp).level; l += 1) {
    if (prevXp < thresholdFor(l) && nextXp >= thresholdFor(l) && !recorded.has(l)) out.push(l);
  }
  return out;
}
```

(`totalXp`, `momentum`, `localDateStr` unchanged. Delete the old `LEVELS` export; grep the repo for `LEVELS` imports and update — `server/test/xp.test.js` is the only consumer.)

- [ ] **Step 4: Run the full server suite** — `npx vitest run --root server` all green (awards/quests tests exercise crossings; the ascension test seeds 394+15 → still crosses 400 → level 5 ✓).

- [ ] **Step 5: Commit** — `feat: uncapped level ladder with named ranks and procedural star tiers`

---

### Task 2: rankTheme + insignia + header accent + fxRank setting

**Files:**
- Create: `web/src/rankTheme.js`, `web/src/components/RankInsignia.jsx`
- Modify: `web/src/components/HeaderTicker.jsx`, `web/src/components/SettingsDrawer.jsx`, `server/state/schemas.js` (settings `fxRank: z.boolean().default(true)`), `server/state/io.js` (DEFAULTS.settings gains `fxRank: true`), `CLAUDE.md` (settings shape + uncapped-levels note), `e2e/smoke.spec.js` (insignia assertion)
- Test: `web/test/components.test.jsx`, `server/test/state-io.test.js` (settings default)

**Interfaces:**
- Produces: `rankTheme(level) → { name, accentTier, accent: {barGrad, numGlow, numColor}, fx: string[] }`; `<RankInsignia level={n} size={px} />` (renders `<svg data-testid="rank-insignia">`). FX names (exact, ordered by unlock level 2..10): `panelFocus, energyFlow, ringDraw, decode, bootCascade, dataRain, spectral, gildedSweep, aurora`.
- Accent tiers: `base` (1–5, barGrad `linear-gradient(90deg,#7A1FBF,#D24BFF 60%,#3FE8FF)`, numColor `#3FE8FF`), `violet` (6–7, `linear-gradient(90deg,#5A1FD9,#9D4BFF 60%,#3FE8FF)`, numColor `#B98CFF`), `spectral` (8, `linear-gradient(90deg,#8CF5FF,#E8FBFF)`, numColor `#D9FBFF`), `gilded` (9, `linear-gradient(90deg,#D24BFF,#FFD166)`, numColor `#FFD166`), `monarch` (10+, `linear-gradient(90deg,#FFF3C4,#FFD166 50%,#FFFFFF)`, numColor `#FFF3C4`). numGlow = `0 0 12px <numColor at .55 alpha>`.

- [ ] **Step 1: Failing tests** (append to `web/test/components.test.jsx`):

```jsx
import { rankTheme } from '../src/rankTheme.jsx' // note: .jsx only if JSX inside; else .js
import { RankInsignia } from '../src/components/RankInsignia.jsx';

it('rankTheme accumulates fx and assigns accent tiers', () => {
  expect(rankTheme(1).fx).toEqual([]);
  expect(rankTheme(4).fx).toEqual(['panelFocus', 'energyFlow', 'ringDraw']);
  expect(rankTheme(10).fx).toHaveLength(9);
  expect(rankTheme(14).fx).toHaveLength(9);          // star tiers add no new fx
  expect(rankTheme(5).accentTier).toBe('base');
  expect(rankTheme(7).accentTier).toBe('violet');
  expect(rankTheme(8).accentTier).toBe('spectral');
  expect(rankTheme(9).accentTier).toBe('gilded');
  expect(rankTheme(12).accentTier).toBe('monarch');
});

it('RankInsignia renders an svg with a star badge past level 10', () => {
  const { container, rerender } = render(<RankInsignia level={4} size={18} />);
  expect(container.querySelector('[data-testid="rank-insignia"]')).toBeTruthy();
  rerender(<RankInsignia level={12} size={18} />);
  expect(screen.getByText('★3')).toBeTruthy();
});

it('HeaderTicker shows the rank insignia', () => {
  render(<HeaderTicker xp={xp} momentum={21} settings={settings}
    onOpenSettings={() => {}} onToggleMotion={() => {}} />);
  expect(document.querySelector('[data-testid="rank-insignia"]')).toBeTruthy();
});
```

Server test (`state-io.test.js`): `expect(readStateFile(dir, 'settings').fxRank).toBe(true);`

- [ ] **Step 2: Run both suites** — new tests fail.

- [ ] **Step 3: Implement.** `rankTheme.js`: FX_LADDER array (level 2..10 names above), `fx = FX_LADDER.slice(0, Math.max(0, Math.min(level, 10) - 1))`; accent tier by band; name via same table as server (duplicate the 10 names — comment pointing at server/xp.js as the source of truth). `RankInsignia.jsx`: one `<svg viewBox="0 0 24 24" data-testid="rank-insignia">` — levels 1–5: n stacked chevron `<path>`s (`M4 {y} l8 -5 l8 5` strokes); 6 hexagon path; 7 triangle with circuit-dot; 8 hollow diamond; 9 three vertical bars + crown line; 10 crown path (5-point zigzag + base bar); level > 10: crown + `<text>` `★{level-9}` at 8px. Stroke `currentColor`, no fill (except crown base), strokeWidth 1.5. HeaderTicker: insignia sits left of the LEVEL number, colored `accent.numColor`; number color/glow + Bar grad come from `rankTheme(xp.level).accent`. SettingsDrawer: FX://RANK checkbox row (same pattern as SCANLINES row) → `onSaveSettings({...settings, fxRank: !settings.fxRank})`. Schemas + DEFAULTS + CLAUDE.md per Files list. E2E: after the wordmark assertion add `await expect(page.locator('[data-testid="rank-insignia"]')).toBeVisible();`.

- [ ] **Step 4: Full server + web suites green.** E2E deferred to Task 6 (worktree run).

- [ ] **Step 5: Commit** — `feat: rank theme, insignia, header accents, fxRank setting`

---

### Task 3: FX engine + GSAP tier-1 effects (panelFocus, energyFlow, ringDraw)

**Files:**
- Create: `web/src/hooks/useRankFx.js`, `web/src/fx/panelFocus.js`, `web/src/fx/energyFlow.js`, `web/src/fx/ringDraw.js`
- Modify: `web/package.json` (add `gsap` ^3.13, `ogl` ^1), `web/src/App.jsx` (call the hook; add `data-fx-root` to the grid container; panels get `data-fx-panel`), `web/src/components/HeaderTicker.jsx` (XP bar fill element gets `data-fx-xpbar`; momentum ring circle gets `data-fx-ring`)
- Test: `web/test/useRankFx.test.jsx` (new file)

**Interfaces:**
- Produces: `useRankFx(level, settings)` — resolves `rankTheme(level).fx`, filters by gating, dynamic-imports `../fx/<name>.js`, calls `mount({ root: document })` once per module, `unmount()` on removal/cleanup. Exposes nothing (side-effect hook). FX module contract: `export function mount(ctx) {}` / `export function unmount() {}` — idempotent unmount.
- DOM hooks other tasks rely on: `[data-fx-panel]` (the three columns + header + agenda), `[data-fx-xpbar]`, `[data-fx-ring]`, `[data-fx-root]`.

- [ ] **Step 1: Failing gating tests** (`web/test/useRankFx.test.jsx`) — mock dynamic imports with `vi.mock`; assert: level 1 mounts nothing; level 4 mounts exactly panelFocus+energyFlow+ringDraw; reducedMotion true mounts nothing; fxRank false mounts nothing; unmount called when settings flip fxRank off. Use a test harness component calling the hook; `await waitFor(...)` for async imports. Mock pattern:

```jsx
const mounted = [];
vi.mock('../src/fx/panelFocus.js', () => ({ mount: () => mounted.push('panelFocus'), unmount: () => { const i = mounted.indexOf('panelFocus'); if (i >= 0) mounted.splice(i, 1); } }));
// …same for energyFlow, ringDraw; the level cap in tests stays ≤4 so only three mocks are needed.
```

- [ ] **Step 2: Run** — fails (hook missing).

- [ ] **Step 3: Implement.** `npm install` gsap + ogl in web workspace. Hook: `useEffect` on `[level, settings.reducedMotion, settings.fxRank]`; keeps a `useRef(Map)` of name→module; on change computes target set (empty if gated), imports missing (`await import(/* @vite-ignore */ \`../fx/${name}.js\`)` — use a static map object `{panelFocus: () => import('../fx/panelFocus.js'), …}` instead so Vite can code-split), mounts new, unmounts removed; full unmount on effect cleanup. FX modules:

`panelFocus.js` — on mount, `gsap.utils.toArray('[data-fx-panel]')`, add mouseenter/leave listeners tweening `boxShadow`/`borderColor`/`y: -1` (0.35s, expo.out); unmount removes listeners + kills tweens.

`energyFlow.js` — mount: create a `MutationObserver`-free approach: `gsap.to` on `[data-fx-xpbar]` is owned by React width styles — instead overlay: append a `<div class="fx-sweep">` inside the bar track (absolute, 40px wide gradient `rgba(255,255,255,.28)` masked), infinite `gsap.fromTo(x: -40 → trackWidth, duration 3.2, ease 'none', repeat -1, repeatDelay 2)`. Unmount removes node + kills tween.

`ringDraw.js` — mount: `gsap.registerPlugin(DrawSVGPlugin)`; `gsap.from('[data-fx-ring]', { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' })`; add CSS class `fx-ring-breathe` to the ring when its parent has `data-momentum-high` (HeaderTicker sets that attr when momentum ≥ 70 — add in this task); keyframe in index.html global style (opacity glow pulse 2.4s). Unmount: kill tween, remove class.

- [ ] **Step 4: Suites green** (`npx vitest run --root web`, server suite untouched but run once).

- [ ] **Step 5: Commit** — `feat: rank fx engine with gated lazy loading, tier-1 gsap effects`

---

### Task 4: FX tier-2 — decode, bootCascade, dataRain

**Files:**
- Create: `web/src/fx/decode.js`, `web/src/fx/bootCascade.js`, `web/src/fx/dataRain.js`
- Modify: `web/test/useRankFx.test.jsx` (extend mocks/coverage to level 7)

**Interfaces:** same module contract. New DOM hooks: section titles already render via `SectionTitle` — give its outer div `data-fx-title`; notification lines `data-fx-note-line` (Notification.jsx).

- [ ] **Step 1: Extend gating test** — level 7 mounts exactly 6 modules (through dataRain). Run; fails until modules exist (mock them too).

- [ ] **Step 2: Implement.**

`decode.js` — `gsap.registerPlugin(ScrambleTextPlugin)`; on mount scramble-decode all `[data-fx-title]` once (`scrambleText: { text: '{original}', chars: 'upperCase', speed: 0.4 }, duration: 0.9, stagger: 0.06`); attach a `MutationObserver` on the notification container to decode `[data-fx-note-line]` on insertion (duration 0.5). Unmount: disconnect observer, kill tweens. IMPORTANT: read each element's text before scrambling and restore it in unmount (never leave scrambled text).

`bootCascade.js` — on mount (page-load only; module loads once per session): timeline over `[data-fx-panel]`: `gsap.from(panels, { clipPath: 'inset(0 100% 0 0)', y: 8, opacity: 0.3, duration: 0.7, ease: 'expo.out', stagger: 0.09 })`; sets `document.documentElement.dataset.fxCascade = '1'` so the CSS `dashIn` animation is suppressed while active (`[data-fx-cascade="1"] [data-fx-panel] { animation: none }` added to index.html styles). Unmount: remove attr, kill timeline.

`dataRain.js` — full-viewport fixed `<canvas>` at z-index 0 (behind panels, above bg), `opacity: 0.05`; classic rain: column array sized `floor(width/14)`, glyph pool of 60 katakana (`アイウエオカキクケコサシスセソタチツテトナニヌネノ…`) + digits; each frame `ctx.fillStyle='rgba(10,7,20,0.08)'; fillRect` then draw one glyph per column at `y[i]`, advance, reset randomly past bottom. rAF loop; listeners: `resize` (rebuild columns), `visibilitychange` (cancel/resume rAF). Unmount: cancel rAF, remove canvas + listeners.

- [ ] **Step 3: Suites green.**
- [ ] **Step 4: Commit** — `feat: rank fx tier-2 - scramble decode, boot cascade, data rain`

---

### Task 5: FX tier-3 — spectral, gildedSweep, aurora

**Files:**
- Create: `web/src/fx/spectral.js`, `web/src/fx/gildedSweep.js`, `web/src/fx/aurora.js`
- Modify: `web/test/useRankFx.test.jsx` (extend to level 10+), `web/src/components/Radar.jsx` (polygon gets `data-fx-radar`), `web/index.html` (append the shared SVG filter def markup via fx — no, spectral INJECTS its filter def at mount; index.html untouched)

**Interfaces:** same contract. `aurora.mount(ctx)` also reads `ctx.starTier` (int ≥ 0) — `useRankFx` passes `{ root: document, starTier: Math.min(Math.max(level - 10, 0), 5) }` to every mount (extend hook + its tests in this task).

- [ ] **Step 1: Extend gating tests** — level 10 mounts all 9; `starTier` passed correctly at level 12 (mock captures ctx). Fails first.

- [ ] **Step 2: Implement.**

`spectral.js` — mount injects one `<svg width="0" height="0">` def: `<filter id="fx-spectral"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="1" result="n" seed="2"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0"/></filter>`. On notification insertion (MutationObserver, same container hook as decode) and once on the radar polygon per data refresh: set `filter: url(#fx-spectral)` and `gsap.fromTo` the `feDisplacementMap` scale attr 14 → 0 (0.45s, power3.out, `attr:{scale:…}`), removing the filter style on complete. Unmount: disconnect, remove def, clear filters.

`gildedSweep.js` — absolutely-positioned gradient streak `<div>` inside the header (`[data-fx-panel]` first element), `mixBlendMode: 'screen'`, gold gradient, masked to the header's clip-path via `clipPath: inherit`; timeline: sweep x from -20% → 120% over 1.8s, ease `power2.inOut`, `repeatDelay: 45`, repeat -1. Unmount removes node, kills timeline.

`aurora.js` — OGL: `Renderer({ dpr: 0.5 })`, fullscreen `Triangle` geometry, fragment shader: 3-octave value-noise FBM over `uv * 1.6 + uTime * 0.02`, three color layers mixed by noise bands — `vec3(0.28,0.09,0.44)` violet, `vec3(0.10,0.35,0.42)` cyan, `vec3(0.55,0.42,0.16)` gold — intensity uniform `uIntensity = 0.5 + 0.1 * starTier`; final alpha ~0.35. Canvas fixed, z-index 0, `pointer-events: none`, below dataRain. rAF render loop gated by `visibilitychange`; `resize` handler. Unmount: cancel loop, lose context (`gl.getExtension('WEBGL_lose_context')?.loseContext()`), remove canvas.

Shader source (inline string in the module):

```glsl
precision highp float;
uniform float uTime; uniform float uIntensity; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<3;i++){ v+=a*noise(p); p*=2.1; a*=.5; } return v; }
void main(){
  vec2 uv = vUv * 1.6; float t = uTime * 0.02;
  float n1 = fbm(uv + t), n2 = fbm(uv * 1.7 - t * 1.3), n3 = fbm(uv * 0.7 + t * 0.6);
  vec3 col = vec3(0.28,0.09,0.44)*smoothstep(.35,.85,n1)
           + vec3(0.10,0.35,0.42)*smoothstep(.45,.9,n2)
           + vec3(0.55,0.42,0.16)*smoothstep(.6,.95,n3)*0.6;
  gl_FragColor = vec4(col * uIntensity, 0.35);
}
```

- [ ] **Step 3: Suites green.**
- [ ] **Step 4: Commit** — `feat: rank fx tier-3 - spectral displacement, gilded sweep, ogl aurora`

---

### Task 6: Ascension timeline + staged smoke + rollout

**Files:**
- Modify: `web/src/components/AscensionOverlay.jsx` (GSAP master timeline; props gain `name` — App passes `levelInfo` name from award.xp.name), `web/src/App.jsx` (pass rank name), `e2e/smoke.spec.js` (already has insignia assertion from Task 2 — verify)
- Test: `web/test/components.test.jsx` (overlay reduced-motion fallback renders name + insignia statically)

**Interfaces:**
- Consumes: `rankTheme`, `RankInsignia`, gsap (ScrambleText + DrawSVG registered), `award.xp.name` (server already returns it via levelInfo).

- [ ] **Step 1: Failing test** — render `<AscensionOverlay level={6} name="Architect" reducedMotion onClose={vi.fn()} />`; assert `LEVEL UP — ARCHITECT` text and `[data-testid="rank-insignia"]` present (static fallback path).

- [ ] **Step 2: Implement.** Overlay accepts `{level, name, reducedMotion, onClose}`. reducedMotion → current static markup + insignia (large, 72px). Otherwise on mount build timeline: backdrop opacity snap (0→1, .18s) → rank name element scramble-decode (`scrambleText`, 1.1s) → insignia paths `drawSVG: '0%' → '100%'` (0.9s, stagger 0.12) → shockwave: absolutely-centered border ring scaling 0→2.2 with opacity fade (0.9s, expo.out) + 24 particle divs (4px, accent color) tweened outward on random vectors (`physics-free`: gsap `x/y` random(120,320), opacity → 0, 1.2s, stagger 0.01) → settle. `onClick` anywhere: `tl.kill()` + onClose. Cleanup kills timeline on unmount. App passes `name` from the award (`result.award.xp.name`) — store `{level, name}` in ascend state.

- [ ] **Step 3: All suites green; E2E from an ISOLATED WORKTREE** (per CLAUDE.md note): `git worktree add ../thesystem-e2e HEAD && cd ../thesystem-e2e && npm install && npm run e2e`, then remove the worktree.

- [ ] **Step 4: Staged browser smoke.** Rebuild the demo vault (scratchpad demo-setup.mjs) THREE times with ledger seeds hitting: level 5 total (~454: entries sum 180 + report 274 — reuse real report fixture at 249 → seed 205), level 8 (~1005: seed 756), level 12 (~2750: seed 2501). For each: start demo server on 4779, Playwright-shoot dashboard.png variant, verify visually: decode on titles (5), rain+spectral present (8), aurora + MONARCH ★3 insignia + gold accents (12). Record a perf note: in the level-12 run, `page.evaluate(() => new Promise(r => { let n = 0; const obs = new PerformanceObserver((l) => { n += l.getEntries().length; }); obs.observe({ type: 'longtask', buffered: true }); setTimeout(() => r(n), 5000); }))` — expect 0-1 long tasks in 5s idle. Kill demo server after.

- [ ] **Step 5: Commit** — `feat: gsap ascension ceremony with rank reveal`

- [ ] **Step 6: Rollout.** Merge branch → main (suites green on merged result), `npm run build`, restart via system-restart skill flow, verify live `/api/dashboard` ok + header shows FDM insignia at your real XP, push main to origin with the gh credential helper.

---

## Self-Review (completed)

- **Spec coverage:** §1 ladder → Task 1; §2 identity → Task 2; §3 FX table + gating → Tasks 3–5 (module-per-effect, gating tests each tier); §4 ascension → Task 6; §5 deps/tests/e2e/smoke → Tasks 3 (deps), 1–6 (tests), 6 (e2e worktree + staged smoke + perf); §6 rollout → Task 6 Step 6. fxRank default-parse risk → Task 2.
- **Placeholder scan:** all steps carry code or exact commands; FX module descriptions include the concrete GSAP/canvas/shader code or exact tween parameters.
- **Type consistency:** `thresholdFor`/`levelInfo`/`newCrossings` signatures consistent across Tasks 1/6; fx module contract `{mount(ctx), unmount()}` uniform across 3–5; `ctx.starTier` added in Task 5 and back-propagated to the hook there; DOM hooks (`data-fx-*`) declared in Task 3 and consumed in 4–6.
