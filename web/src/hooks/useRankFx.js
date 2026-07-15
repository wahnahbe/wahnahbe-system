import { useEffect } from 'react';
import { rankTheme } from '../rankTheme.js';

// Static import map so Vite can code-split each fx module; every entry must
// exist (even the tier-2/3 modules Tasks 4-5 haven't built yet) or the build
// breaks on this file's static analysis of the dynamic import specifiers.
const FX_MODULES = {
  panelFocus: () => import('../fx/panelFocus.js'),
  energyFlow: () => import('../fx/energyFlow.js'),
  ringDraw: () => import('../fx/ringDraw.js'),
  decode: () => import('../fx/decode.js'),
  bootCascade: () => import('../fx/bootCascade.js'),
  dataRain: () => import('../fx/dataRain.js'),
  spectral: () => import('../fx/spectral.js'),
  gildedSweep: () => import('../fx/gildedSweep.js'),
  aurora: () => import('../fx/aurora.js'),
};

/**
 * Mounts the GSAP fx modules unlocked at the current rank, lazily importing
 * each one, and tears them all down when gated off (reducedMotion or
 * fxRank===false) or when the unlocked set changes. Side-effect only hook —
 * exposes nothing.
 * @param {number} level
 * @param {{ reducedMotion?: boolean, fxRank?: boolean }} settings
 */
export function useRankFx(level, settings) {
  const reducedMotion = settings?.reducedMotion === true;
  const fxRank = settings?.fxRank !== false;

  useEffect(() => {
    const gated = reducedMotion || !fxRank;
    const targetNames = gated ? [] : rankTheme(level).fx;
    let cancelled = false;
    const active = new Map();

    (async () => {
      for (const name of targetNames) {
        const loadModule = FX_MODULES[name];
        if (!loadModule) continue;
        const mod = await loadModule();
        if (cancelled) return;
        mod.mount?.({ root: document });
        active.set(name, mod);
      }
    })();

    return () => {
      cancelled = true;
      for (const mod of active.values()) mod.unmount?.();
      active.clear();
    };
  }, [level, reducedMotion, fxRank]);
}
