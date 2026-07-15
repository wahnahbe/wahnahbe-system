# Uncapped Levels + Rank FX — Design Spec

**Date:** 2026-07-13
**Status:** Approved in brainstorm
**Context:** User hit the level-5 cap at 454 XP (bar pegged at MAX). Levels must be infinite, and each rank must *reward* — via premium visual identity and page-level effect unlocks, not manual-input chores.

## 1. Uncapped ladder

The vault report card defines Level 5 as "400+" (open-ended); everything above 400 subdivides that band — the vault is never contradicted.

**Named ranks (server/xp.js `LEVELS`):**

| Lv | Name | Min XP | Width |
|---|---|---|---|
| 1 | Apprentice | 0 | 40 |
| 2 | Practitioner | 40 | 80 |
| 3 | Analyst | 120 | 120 |
| 4 | Engineer | 240 | 160 |
| 5 | Forward-Deployed Master | 400 | 160 |
| 6 | Architect | 560 | 200 |
| 7 | Netrunner | 760 | 240 |
| 8 | Ghost | 1000 | 300 |
| 9 | Sovereign | 1300 | 350 |
| 10 | Monarch | 1650 | 450 |

**Procedural past 10:** level 11 = `Monarch ★2` at 2100, and each subsequent tier's width = `round(prevWidth × 1.28 / 10) × 10` (450 → 580 → 740 → 950 → …), computed on demand in `levelInfo` (loop, no table to exhaust). Names: `Monarch ★{n-9}` for level n ≥ 11.

**levelInfo changes:** the `xpForNext: null` / `pct: 100` MAX branch is removed — there is always a next threshold. Return shape unchanged otherwise. `newCrossings` needs no change (works on thresholds; procedural thresholds resolved via a shared `thresholdFor(level)` helper so crossings and levelInfo can never disagree). Existing crossing `[5]` in the live ledger stays valid; at 454 XP the header shows Level 5, 54/160 into the band (34%).

## 2. Rank identity (insignia + accent)

`web/src/rankTheme.js` — pure lookup module, single source of truth for everything rank-visual:

- `rankTheme(level)` → `{ name, insignia, accent, fx: [...] }`.
- **Insignia**: inline SVG per rank — levels 1–5 stack 1–5 chevrons; 6 hexagon, 7 circuit-triangle, 8 hollow diamond, 9 crowned bars, 10 crown. ★ tiers: crown + small star count (numeric badge past ★5). Rendered beside the level number in HeaderTicker and large in the ascension overlay.
- **Accent tier**: gradient + glow tokens applied ONLY to the header level block (level number glow, XP bar gradient) and ascension overlay — bands: 1–5 default magenta/cyan; 6–7 deep violet; 8 spectral white-cyan; 9 gold-edged; 10+ white-gold. The rest of the UI keeps the base palette.

## 3. Rank FX — premium page-level unlocks

Each rank permanently unlocks one effect; effects stack. Engine: **GSAP 3.13+** (all plugins now free — ScrambleText, DrawSVG) and **OGL** (zero-dep minimal WebGL) for the shader. All effect modules live in `web/src/fx/<name>.js`, each exporting `{ mount(ctx), unmount() }`, **dynamically imported only when its rank is unlocked** — no shader bytes shipped to a level-2 player.

| Lv | FX module | Behavior | Technique |
|---|---|---|---|
| 2 | `panelFocus` | Panels lift/glow subtly on hover | GSAP micro-tween, expo.out |
| 3 | `energyFlow` | XP bar fill animates on change; slow light current sweeps the bar | GSAP width tween + masked gradient sweep |
| 4 | `ringDraw` | Momentum ring strokes itself in on load; breathes when momentum ≥ 70 | DrawSVG + CSS keyframe |
| 5 | `decode` | Section titles + notification lines scramble-decode on mount | ScrambleText |
| 6 | `bootCascade` | Panels wipe in via staggered clip-path reveals on load (replaces dashIn while active) | GSAP master timeline |
| 7 | `dataRain` | Faint katakana rain across the backdrop, ~4% opacity, fading trails | Canvas + rAF, glyph pooling, pauses on hidden tab |
| 8 | `spectral` | Notifications + radar polygon get organic turbulence displacement on entry | SVG feTurbulence + feDisplacementMap, GSAP-driven seed |
| 9 | `gildedSweep` | Rare gold light sweep tracing the header's clip-path edge (~45s period) | masked gradient + GSAP |
| 10 | `aurora` | FBM fragment-shader color field behind all panels (violet/cyan/gold), half-resolution render; ★ tiers raise intensity (capped at ★5) | OGL WebGL shader |

**Orchestration & discipline:**
- `useRankFx(level, settings)` hook resolves the unlocked list from `rankTheme`, dynamic-imports modules, mounts/unmounts on level or settings change.
- ALL effects disabled when `settings.reducedMotion` (existing `data-rm` contract) or when the new `settings.fxRank === false` toggle (SYS://CONFIG gains an FX://RANK row). `settings` schema adds `fxRank: z.boolean().default(true)` — **`.default()` so the live settings.json (which lacks the key) still parses**.
- Canvas/shader effects pause via `document.visibilitychange`; aurora renders at half resolution.

## 4. Ascension overlay — the crown-jewel moment

One GSAP master timeline on ascension: backdrop snap → rank name **scramble-decodes** → insignia **draws itself** (DrawSVG stroke) → particle burst + expanding shockwave ring → settle to `LEVEL UP — {RANK NAME}` with threshold caption. Reduced-motion fallback: current static overlay with rank name + insignia, no animation. Click dismisses at any point (timeline killed cleanly).

## 5. Mechanics & testing

- **Deps:** `gsap` (^3.13), `ogl` — both in web workspace only. FX modules lazy-imported.
- **Server tests:** levelInfo boundaries (559/560, 1649/1650, 2099/2100 ★2), procedural width math, name generation, thresholdFor/levelInfo consistency, no-MAX-branch (levelInfo(454) → level 5, xpForNext 160, pct 33).
- **Web tests:** rankTheme lookup table (insignia/accent/fx per band incl. ★ tiers), useRankFx gating (reducedMotion off, fxRank off, level thresholds — mock the dynamic imports), settings schema default, drawer toggle render. Visual/GSAP internals are NOT unit-tested — verified by browser smoke.
- **E2E:** fixture vault stays at 249 XP (level 4) so text-mutating FX (decode, level 5) never runs during assertions; existing assertions unaffected. One new assertion: header shows the rank insignia SVG (`data-testid="rank-insignia"`).
- **Browser smoke (manual, staged):** demo vault at three XP seeds — level 5 (decode), level 8 (spectral+rain), level 12 (aurora ★3) — screenshot each, verify perf (no long tasks > 50ms sustained; aurora ≤ ~2ms/frame at half-res).

## 6. Rollout

Feature branch → review gate → merge → rebuild + restart via system-restart flow → push public. CLAUDE.md: settings shape line gains `fxRank`; note that levels are uncapped (dashboard subdivides the report card's open "400+" band).
