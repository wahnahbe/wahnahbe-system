import React from 'react';

const STROKE = 1.5;

/** @param {{ level: number }} props */
function Chevrons({ level }) {
  const ys = Array.from({ length: level }, (_, i) => 19 - i * 4);
  return ys.map((y, i) => (
    <path key={i} d={`M4 ${y} l8 -5 l8 5`} fill="none" stroke="currentColor" strokeWidth={STROKE} />
  ));
}

function Hexagon() {
  return <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" fill="none" stroke="currentColor" strokeWidth={STROKE} />;
}

function CircuitTriangle() {
  return (
    <>
      <path d="M12 3 L21 20 L3 20 Z" fill="none" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" />
    </>
  );
}

function HollowDiamond() {
  return <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth={STROKE} />;
}

function CrownedBars() {
  return (
    <>
      <path d="M4 20 L4 10" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M12 20 L12 6" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M20 20 L20 10" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M2 4 L12 1 L22 4" fill="none" stroke="currentColor" strokeWidth={STROKE} />
    </>
  );
}

function Crown() {
  return (
    <>
      <path d="M3 9 L7 13 L12 4 L17 13 L21 9 L19 18 L5 18 Z" fill="none" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M5 18 L19 18" stroke="currentColor" strokeWidth={STROKE} fill="currentColor" />
    </>
  );
}

/**
 * Rank insignia icon, one shape per named rank (1–10); level > 10 renders the
 * crown with a small ★N badge (N = level - 9).
 * @param {{ level: number, size?: number, color?: string }} props
 */
export function RankInsignia({ level, size = 24, color }) {
  const clamped = Math.max(1, Math.floor(level));

  return (
    <svg data-testid="rank-insignia" viewBox="0 0 24 24" width={size} height={size}
      style={color ? { color } : undefined}>
      {clamped <= 5 && <Chevrons level={clamped} />}
      {clamped === 6 && <Hexagon />}
      {clamped === 7 && <CircuitTriangle />}
      {clamped === 8 && <HollowDiamond />}
      {clamped === 9 && <CrownedBars />}
      {clamped >= 10 && <Crown />}
      {clamped > 10 && (
        <text x="20" y="23" textAnchor="end" fontSize="8" fill="currentColor">★{clamped - 9}</text>
      )}
    </svg>
  );
}
