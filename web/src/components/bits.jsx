import React from 'react';
import { C, fonts } from '../theme.js';

/**
 * Section header with magenta title and optional JP subtitle.
 * @param {{ children: React.ReactNode, jp?: string, showJp?: boolean }} props
 */
export const SectionTitle = ({ children, jp, showJp }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '12px 16px 9px', borderBottom: `1px solid rgba(210,75,255,.35)` }}>
    <div data-fx-title style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 15, letterSpacing: '.2em', color: C.mag }}>{children}</div>
    {showJp && jp && <div style={{ fontFamily: fonts.jp, fontSize: 10, color: 'rgba(63,232,255,.55)' }}>{jp}</div>}
  </div>
);

/**
 * HUD progress bar. Renders angled (clipped) by default, or flat (square
 * ends) when `flat` is set. `trackAttrs` spreads onto the outer (track)
 * element — used by HeaderTicker to tag the XP bar for fx hooking without
 * every Bar instance picking up that hook.
 * @param {{ pct: number, grad?: string, h?: number, flat?: boolean, trackAttrs?: object }} props
 */
export const Bar = ({ pct, grad = `linear-gradient(90deg,#7A1FBF,${C.mag} 60%,${C.cyan})`, h = 9, flat = false, trackAttrs = {} }) => {
  const fillProps = flat ? { 'data-flat': '1' } : {};
  return (
    <div {...trackAttrs} style={{ position: 'relative', height: h, background: C.deep, border: '1px solid rgba(210,75,255,.4)',
      ...(!flat && { clipPath: 'polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)' }) }}>
      <div {...fillProps} style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: grad,
        boxShadow: flat ? '0 0 6px rgba(63,232,255,.5)' : '0 0 10px rgba(210,75,255,.7)' }} />
    </div>
  );
};

/**
 * Clipped HUD button.
 * @param {{ onClick?: () => void, children: React.ReactNode, small?: boolean }} props
 */
export const HudButton = ({ onClick, children, small }) => (
  <button onClick={onClick} style={{ background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)',
    color: C.cyan, fontSize: small ? 9 : 10, letterSpacing: '.14em', padding: small ? '4px 10px' : '6px 12px',
    cursor: 'pointer', clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)', fontFamily: fonts.mono }}>
    {children}
  </button>
);

export const inputStyle = {
  background: 'rgba(11,7,22,.85)', border: '1px solid rgba(210,75,255,.35)', color: C.text,
  fontSize: 10, padding: '4px 8px', outline: 'none', letterSpacing: '.05em', fontFamily: fonts.mono,
  colorScheme: 'dark',
};

export const HudInput = (props) => <input {...props} style={{ ...inputStyle, ...props.style }} />;

export const HudSelect = (props) => (
  <select {...props} style={{ ...inputStyle, color: C.cyan, ...props.style }}>{props.children}</select>
);
