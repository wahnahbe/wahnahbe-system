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
