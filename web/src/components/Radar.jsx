import React from 'react';
import { C, fonts } from '../theme.js';
import { STAT_ABBR } from './StatusPanel.jsx';

const ANGLES = Array.from({ length: 8 }, (_, i) => (Math.PI * 2 * i) / 8 - Math.PI / 2);

// Ring opacities from design source of truth (docs/design/wahnahbe-v2.dc.html RIGHT: SKILLS radar).
const RING_OPACITY = [0.3, 0.18, 0.14];

/** ABBR map for radar axis labels: reuse StatusPanel's STAT_ABBR, extended with GENERAL if absent. */
export const ABBR = STAT_ABBR.GENERAL ? STAT_ABBR : { ...STAT_ABBR, GENERAL: 'GEN' };

/**
 * @typedef {{ name: string, average: number|null, status: string }} CoreStat
 */

/**
 * Maps 8 core stats onto octagon radar points (8 axes at 45deg steps, starting straight up).
 * `average == null` renders as a visible dot near center (0.06 * r).
 * @param {CoreStat[]} stats
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @returns {string} SVG points string
 */
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

/**
 * Octagon radar (8 core stats): grid rings + spokes + filled data polygon + axis labels.
 * @param {{ stats: CoreStat[] }} props
 */
export const Radar = ({ stats }) => {
  const cx = 130; const cy = 128; const r = 88;
  return (
    <svg width="100%" viewBox="0 0 260 256" style={{ flex: 'none' }}>
      {[r, (r * 2) / 3, r / 3].map((rr, idx) => (
        <polygon key={rr} points={ring(cx, cy, rr)} fill="none" stroke={`rgba(210,75,255,${RING_OPACITY[idx]})`} strokeWidth="1" />
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
            {ABBR[s.name] ?? s.name} {s.average == null ? '—' : s.average}
          </text>
        );
      })}
    </svg>
  );
};
