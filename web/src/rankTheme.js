// Rank names mirror server/xp.js NAMED_LEVELS verbatim — server/xp.js is the
// source of truth for level→name resolution; this table is a UI-side copy so
// rankTheme() stays a pure, dependency-free lookup.
const NAMES = [
  'Apprentice', 'Practitioner', 'Analyst', 'Engineer', 'Forward-Deployed Master',
  'Architect', 'Netrunner', 'Ghost', 'Sovereign', 'Monarch',
];

// FX unlock ladder, ordered by the level (2..10) that unlocks each effect.
const FX_LADDER = [
  'panelFocus', 'energyFlow', 'ringDraw', 'decode', 'bootCascade',
  'dataRain', 'spectral', 'gildedSweep', 'aurora',
];

const ACCENT_TIERS = {
  base: { barGrad: 'linear-gradient(90deg,#7A1FBF,#D24BFF 60%,#3FE8FF)', numColor: '#3FE8FF' },
  violet: { barGrad: 'linear-gradient(90deg,#5A1FD9,#9D4BFF 60%,#3FE8FF)', numColor: '#B98CFF' },
  spectral: { barGrad: 'linear-gradient(90deg,#8CF5FF,#E8FBFF)', numColor: '#D9FBFF' },
  gilded: { barGrad: 'linear-gradient(90deg,#D24BFF,#FFD166)', numColor: '#FFD166' },
  monarch: { barGrad: 'linear-gradient(90deg,#FFF3C4,#FFD166 50%,#FFFFFF)', numColor: '#FFF3C4' },
};

/** @param {number} level */
function accentTierFor(level) {
  if (level <= 5) return 'base';
  if (level <= 7) return 'violet';
  if (level === 8) return 'spectral';
  if (level === 9) return 'gilded';
  return 'monarch'; // 10+
}

/** @param {number} level */
function nameFor(level) {
  return level <= 10 ? NAMES[level - 1] : `Monarch ★${level - 9}`;
}

/**
 * @param {string} hex e.g. '#3FE8FF'
 * @param {number} alpha 0..1
 */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Rank visual identity for a given level: display name, accent tier + tokens,
 * and the ordered list of FX unlocked at or below this level.
 * @param {number} level
 * @returns {{
 *   name: string,
 *   accentTier: 'base'|'violet'|'spectral'|'gilded'|'monarch',
 *   accent: { barGrad: string, numGlow: string, numColor: string },
 *   fx: string[],
 * }}
 */
export function rankTheme(level) {
  const tier = accentTierFor(level);
  const { barGrad, numColor } = ACCENT_TIERS[tier];
  const fxCount = Math.max(0, Math.min(level, 10) - 1);
  return {
    name: nameFor(level),
    accentTier: tier,
    accent: { barGrad, numGlow: `0 0 12px ${hexToRgba(numColor, 0.55)}`, numColor },
    fx: FX_LADDER.slice(0, fxCount),
  };
}
