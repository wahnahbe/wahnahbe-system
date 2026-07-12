import React, { useEffect, useState } from 'react';
import { C, fonts } from '../theme.js';

const LINES = [
  '[SYS] WAHNAHBE KERNEL v2.0',
  '[SYS] LINKING SECOND-BRAIN VAULT…',
  '[SYS] PARSING OPERATIVE RECORD…',
  '[SYS] ALL SYSTEMS NOMINAL',
];
const LINE_INTERVAL_MS = 450;
const FADE_DELAY_MS = 600;
const FADE_DURATION_MS = 600;

/**
 * Full-screen kernel boot overlay: types LINES one at a time, fills a progress
 * bar, then fades (design `bootOut` animation) and calls onDone. Clicking
 * anywhere skips straight to onDone.
 * @param {{ onDone: () => void }} props
 */
export function BootSequence({ onDone }) {
  const [visibleCount, setVisibleCount] = useState(1);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Intentionally runs once: onDone is expected to be a stable state setter
    // (or a closure over one) from the caller, and re-running this effect on
    // every parent re-render would restart the whole boot sequence.
    const timers = [];
    for (let i = 1; i < LINES.length; i += 1) {
      timers.push(setTimeout(() => setVisibleCount(i + 1), i * LINE_INTERVAL_MS));
    }
    const allShownAt = (LINES.length - 1) * LINE_INTERVAL_MS;
    timers.push(setTimeout(() => setFading(true), allShownAt + FADE_DELAY_MS));
    timers.push(setTimeout(() => onDone(), allShownAt + FADE_DELAY_MS + FADE_DURATION_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = (visibleCount / LINES.length) * 100;

  return (
    <div onClick={onDone} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: '#08050F',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      animation: fading ? 'bootOut .6s forwards' : 'none',
    }}>
      <div style={{ width: 460, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {LINES.slice(0, visibleCount).map((line) => (
          <div key={line} style={{
            fontSize: 13, letterSpacing: '.1em', color: C.mag, fontFamily: fonts.mono,
            textShadow: '0 0 8px rgba(210,75,255,.5)',
          }}>{line}</div>
        ))}
        <div style={{ marginTop: 10, height: 2, background: 'rgba(210,75,255,.15)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.mag, boxShadow: '0 0 8px rgba(210,75,255,.8)' }} />
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(63,232,255,.4)', letterSpacing: '.2em', fontFamily: fonts.mono,
          animation: 'bootBlink 1s step-end infinite',
        }}>CLICK TO SKIP</div>
      </div>
    </div>
  );
}
