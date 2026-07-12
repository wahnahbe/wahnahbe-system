import React, { useState } from 'react';
import { C, fonts, panelStyle } from '../theme.js';
import { SectionTitle, Bar, HudButton, HudInput } from './bits.jsx';
import { Sparkline } from './Sparkline.jsx';

export const STAT_ABBR = {
  Conceptual: 'CON',
  Mathematical: 'MATH',
  'Statistical & Data Reasoning': 'STAT',
  'Programming & Implementation': 'PROG',
  'Software Eng. & Systems': 'SWE',
  'Applied Problem-Solving': 'APP',
  'Communication & Translation': 'COMM',
  'Retention & Connections': 'RET',
};

/** @param {string|undefined} dateStr */
function formatDateDots(dateStr) {
  return dateStr ? dateStr.replaceAll('-', '.') : '';
}

/** @param {React.MouseEvent<HTMLDivElement>} e */
function gaugePctFromClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const raw = Math.round(((e.clientX - rect.left) / (rect.width || 1)) * 100);
  return Math.min(100, Math.max(0, raw));
}

/**
 * @param {{ label: string, value: number, grad: string, glow: string, onClick: (e: React.MouseEvent) => void }} props
 */
function GaugeRow({ label, value, grad, glow, onClick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 34px', gap: 8, alignItems: 'center' }}>
      <div style={{ fontSize: 11, color: C.mag, letterSpacing: '.1em' }}>{label}</div>
      <div onClick={onClick} title="Click to set" style={{
        position: 'relative', height: 13, background: C.deep, border: '1px solid rgba(210,75,255,.45)',
        cursor: 'crosshair', clipPath: 'polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)',
      }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${value}%`, background: grad,
          boxShadow: `0 0 8px ${glow}`,
        }} />
      </div>
      <div style={{ fontSize: 11, color: C.cyan, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

/**
 * @typedef {{ name: string, average: number|null, status: string }} CoreStat
 */

/** @param {{ stat: CoreStat }} props */
function StatRow({ stat }) {
  const abbr = STAT_ABBR[stat.name] ?? stat.name;
  const pct = stat.average != null ? (stat.average / 5) * 100 : 0;
  const right = stat.average != null ? stat.average.toFixed(1) : '—';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr 46px', gap: 9, alignItems: 'center' }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 14, letterSpacing: '.08em', color: C.text }}>
        {abbr}
      </div>
      <div style={{ minWidth: 0 }}>
        <Bar pct={pct} h={8} flat grad="linear-gradient(90deg,#D24BFF,#3FE8FF)" />
        <div style={{ fontSize: 8, color: 'rgba(63,232,255,.5)', letterSpacing: '.04em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {stat.name} · <span style={{ color: 'rgba(242,234,255,.4)' }}>{stat.status}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.cyan, textAlign: 'right' }}>{right}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg,rgba(210,75,255,.5),transparent)' }} />;
}

/**
 * @typedef {{ date: string, lbs: number }} WeighIn
 */

/**
 * SYS://STATUS panel: HP/MP gauges, 8-stat core list, weigh-in log + sparkline.
 * @param {{
 *   learning: { ok: boolean, data?: { stats: CoreStat[] }, error?: string },
 *   health: { hp: number, mp: number, baseline: WeighIn, weighIns: WeighIn[] },
 *   showJp?: boolean,
 *   onGauge: (v: { hp?: number, mp?: number }) => void,
 *   onLogWeighIn: (lbs: number) => void,
 * }} props
 */
export function StatusPanel({ learning, health, showJp, onGauge, onLogWeighIn }) {
  const [wIn, setWIn] = useState('');

  const weighIns = health?.weighIns ?? [];
  const baseline = health?.baseline;
  const latest = weighIns.at(-1);
  const delta = latest && baseline ? latest.lbs - baseline.lbs : null;

  const handleLog = () => {
    const val = parseFloat(wIn);
    if (Number.isFinite(val) && val > 0) {
      onLogWeighIn(val);
    }
    setWIn('');
  };

  return (
    <div style={panelStyle}>
      <SectionTitle jp="ステータス" showJp={showJp}>SYS://STATUS</SectionTitle>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <GaugeRow label="HP" value={health?.hp ?? 0} grad="linear-gradient(90deg,#8A2BD9,#D24BFF)"
            glow="rgba(210,75,255,.6)" onClick={(e) => onGauge({ hp: gaugePctFromClick(e) })} />
          <GaugeRow label="MP" value={health?.mp ?? 0} grad="linear-gradient(90deg,#8A2BD9,#3FE8FF)"
            glow="rgba(63,232,255,.55)" onClick={(e) => onGauge({ mp: gaugePctFromClick(e) })} />
          <div style={{ fontSize: 9, color: 'rgba(242,234,255,.4)', letterSpacing: '.08em' }}>
            [SYS] CLICK GAUGE TO SET · HP=PHYSICAL / MP=FOCUS
          </div>
        </div>

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>CORE STATS</div>
          {learning?.ok === false ? (
            <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
              [SYS] DATA LINK LOST — REPORT CARD
            </div>
          ) : (
            (learning?.data?.stats ?? []).map((st) => <StatRow key={st.name} stat={st} />)
          )}
        </div>

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>WEIGH-IN LOG</div>
            {baseline && (
              <div style={{ fontSize: 9, color: 'rgba(63,232,255,.55)' }}>
                BASELINE {baseline.lbs} · {formatDateDots(baseline.date)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{
                fontFamily: fonts.display, fontWeight: 700, fontSize: 28, lineHeight: 1, color: C.cyan,
                textShadow: '0 0 10px rgba(63,232,255,.4)',
              }}>
                {latest ? latest.lbs : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(242,234,255,.5)', marginTop: 2 }}>
                LBS · Δ {delta != null ? delta.toFixed(1) : '—'} FROM BASELINE
              </div>
            </div>
            <Sparkline points={weighIns} />
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <HudInput value={wIn} onChange={(e) => setWIn(e.target.value)} placeholder="LBS"
              style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '6px 9px' }} />
            <HudButton onClick={handleLog}>LOG</HudButton>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(242,234,255,.4)', letterSpacing: '.06em' }}>
            RECOMP ARC · NUTRITION PROTOCOL
          </div>
        </div>
      </div>
    </div>
  );
}
