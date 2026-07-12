import React, { useEffect, useState } from 'react';
import { C, fonts, clip } from '../theme.js';
import { Bar } from './bits.jsx';

const MOMENTUM_R = 18;
const MOMENTUM_CIRCUMFERENCE = 113; // 2 * PI * 18, rounded per design spec

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {Date} d */
function formatDate(d) {
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${DAYS[d.getDay()]} ${y}.${m}.${day}`;
}

/** @param {Date} d */
function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Top HUD bar: wordmark, level/XP, live clock + momentum ring, settings/motion controls.
 * @param {{
 *   xp: { level: number, xpIntoLevel: number, xpForNext: number|null, pct: number },
 *   momentum: number,
 *   settings: { title: string, reducedMotion: boolean },
 *   onOpenSettings: () => void,
 *   onToggleMotion: () => void,
 * }} props
 */
export function HeaderTicker({ xp, momentum, settings, onOpenSettings, onToggleMotion }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const xpLabel = xp.xpForNext == null ? 'MAX' : `${xp.xpIntoLevel} / ${xp.xpForNext} XP`;
  const momDash = `${(momentum / 100) * MOMENTUM_CIRCUMFERENCE} ${MOMENTUM_CIRCUMFERENCE}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0, height: 84, margin: '12px 14px 0',
      background: C.panel, backdropFilter: 'blur(8px)', border: '1px solid rgba(210,75,255,.5)',
      clipPath: clip(16),
      boxShadow: 'inset 0 0 30px rgba(210,75,255,.07)',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px 0 26px',
        borderRight: '1px solid rgba(210,75,255,.3)', minWidth: 250,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{
            fontFamily: fonts.display, fontWeight: 700, fontSize: 27, letterSpacing: '.14em', color: C.text,
            textShadow: '0 0 14px rgba(210,75,255,.65)',
          }}>WAHNAHBE</div>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.1em' }}>SYS://ONLINE</div>
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(63,232,255,.75)', letterSpacing: '.12em', marginTop: 3 }}>
          GUTIERREZ, J. · DATA OPERATIVE · «<span style={{ color: C.cyan }}>{settings.title}</span>»
        </div>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
        padding: '0 24px', borderRight: '1px solid rgba(210,75,255,.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 10, color: C.mag, letterSpacing: '.18em' }}>LEVEL</span>
            <span style={{
              fontFamily: fonts.display, fontWeight: 700, fontSize: 30, lineHeight: 1, color: C.cyan,
              textShadow: '0 0 12px rgba(63,232,255,.5)',
            }}>{xp.level}</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(242,234,255,.55)', letterSpacing: '.08em' }}>{xpLabel}</div>
        </div>
        <Bar pct={xp.pct} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, padding: '0 20px',
        borderRight: '1px solid rgba(210,75,255,.3)',
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.14em' }}>{formatDate(now)}</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 24, color: C.text, letterSpacing: '.08em' }}>
            {formatTime(now)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r={MOMENTUM_R} fill="none" stroke="rgba(210,75,255,.2)" strokeWidth="3" />
            <circle cx="23" cy="23" r={MOMENTUM_R} fill="none" stroke={C.cyan} strokeWidth="3"
              strokeDasharray={momDash} transform="rotate(-90 23 23)"
              style={{ filter: 'drop-shadow(0 0 4px rgba(63,232,255,.8))' }} />
            <text x="23" y="27" textAnchor="middle" fill={C.cyan} fontSize="11" fontFamily={fonts.mono}>{momentum}</text>
          </svg>
          <div style={{ fontSize: 8.5, color: 'rgba(63,232,255,.6)', letterSpacing: '.16em' }}>MOMENTUM</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '0 18px' }}>
        <button onClick={onOpenSettings} style={{
          background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)', color: C.cyan,
          fontSize: 10, letterSpacing: '.16em', padding: '6px 12px', cursor: 'pointer',
          clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)', fontFamily: fonts.mono,
        }}>SYS://CONFIG</button>
        <button onClick={onToggleMotion} style={{
          background: 'none', border: '1px solid rgba(210,75,255,.3)', color: 'rgba(63,232,255,.7)',
          fontSize: 9, letterSpacing: '.12em', padding: '4px 12px', cursor: 'pointer', fontFamily: fonts.mono,
        }}>{settings.reducedMotion ? 'MOTION://OFF' : 'MOTION://ON'}</button>
      </div>
    </div>
  );
}
