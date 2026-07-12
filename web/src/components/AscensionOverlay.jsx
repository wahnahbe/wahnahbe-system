import React from 'react';
import { fonts } from '../theme.js';

/**
 * Full-screen "LEVEL UP" overlay shown when an award crosses a level
 * threshold. Click anywhere to dismiss.
 * @param {{ level: number|string, onClose: () => void }} props
 */
export function AscensionOverlay({ level, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,.32), rgba(8,5,15,.94) 75%)',
      backdropFilter: 'blur(4px)', animation: 'ascendIn .7s steps(8) both', fontFamily: fonts.mono,
    }}>
      <div style={{ fontSize: 11, color: '#FFFFFF', letterSpacing: '.5em' }}>SYS://ASCENSION</div>
      <div style={{
        fontFamily: fonts.display, fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: '.12em',
        color: '#F2EAFF', textShadow: '0 0 30px rgba(255,255,255,.9),0 0 70px rgba(255,255,255,.5)',
        animation: 'glitchTxt 1.1s steps(4) 3', textAlign: 'center',
      }}>LEVEL UP — {level}</div>
      <div style={{ width: 280, height: 1, background: 'linear-gradient(90deg,transparent,#FFFFFF,transparent)' }} />
      <div style={{ fontSize: 11, color: 'rgba(242,234,255,.7)', letterSpacing: '.2em' }}>
        [SYS] THRESHOLD BREACHED. NEW CAPACITY UNLOCKED.
      </div>
      <div style={{
        fontSize: 9, color: 'rgba(255,255,255,.6)', letterSpacing: '.3em', animation: 'bootBlink 1.2s step-end infinite',
      }}>CLICK TO DISMISS</div>
    </div>
  );
}
