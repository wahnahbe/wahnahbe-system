import React from 'react';
import { C, fonts } from '../theme.js';

/**
 * Fixed top-of-screen HUD notification window. Renders nothing when note is
 * null; the caller (App) owns the auto-clear timer.
 * @param {{ note: { lines: string[] } | null }} props
 */
export function Notification({ note }) {
  if (!note) return null;
  return (
    <div style={{
      position: 'fixed', top: '16%', left: '50%', transform: 'translateX(-50%)', zIndex: 70,
      minWidth: 340, background: 'rgba(22,12,40,.92)', backdropFilter: 'blur(10px)',
      border: `1px solid ${C.mag}`,
      clipPath: 'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)',
      animation: 'notifIn .5s steps(6) both, pulseGlow 1.6s ease-in-out infinite',
      fontFamily: fonts.mono,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px',
        borderBottom: '1px solid rgba(210,75,255,.4)',
      }}>
        <div style={{
          width: 17, height: 17, border: `1.5px solid ${C.cyan}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, color: C.cyan, flex: 'none',
        }}>!</div>
        <div style={{
          fontFamily: fonts.display, fontWeight: 700, fontSize: 13, letterSpacing: '.28em', color: C.cyan,
          animation: 'glitchTxt .9s steps(3) 2',
        }}>NOTIFICATION</div>
      </div>
      <div style={{ padding: '13px 18px 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {note.lines.map((line, i) => (
          <div key={`${i}-${line}`} style={{ fontSize: 12, color: C.text, letterSpacing: '.07em' }}>{line}</div>
        ))}
      </div>
    </div>
  );
}
