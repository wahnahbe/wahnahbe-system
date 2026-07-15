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

const STALE_MASTERY_DAYS = 30;
const MS_PER_DAY = 86400000;
const MASTERY_BAND_COLOR = { solid: C.cyan, forming: C.mag, shaky: 'rgba(242,234,255,.25)' };

/**
 * @typedef {{ name: string, average: number|null, status: string }} CoreStat
 */

/** @param {{ stat: CoreStat, mileage: number|undefined }} props */
function StatRow({ stat, mileage }) {
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
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: C.cyan }}>{right}</div>
        {mileage > 0 && <div style={{ fontSize: 8, color: 'rgba(242,234,255,.4)' }}>+{mileage}xp</div>}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg,rgba(210,75,255,.5),transparent)' }} />;
}

/**
 * @typedef {{ solid: number, forming: number, shaky: number }} MasteryBands
 * @typedef {{ name: string, score: number, band: string, lastSeen: string }} MasteryWeakest
 */

/** @param {{ bands: MasteryBands, total: number }} props */
function MasteryBar({ bands, total }) {
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', height: 8, background: C.deep, border: '1px solid rgba(210,75,255,.4)' }}>
      {['solid', 'forming', 'shaky'].map((band) => bands[band] > 0 && (
        <div key={band} style={{ width: `${(bands[band] / total) * 100}%`, background: MASTERY_BAND_COLOR[band] }} />
      ))}
    </div>
  );
}

/** @param {{ bands: MasteryBands }} props */
function MasteryCounts({ bands }) {
  return (
    <div style={{ fontSize: 9.5, letterSpacing: '.04em', display: 'flex', gap: 6, fontFamily: fonts.mono }}>
      <span style={{ color: MASTERY_BAND_COLOR.solid }}>SOLID {bands.solid}</span>
      <span style={{ color: 'rgba(242,234,255,.3)' }}>·</span>
      <span style={{ color: MASTERY_BAND_COLOR.forming }}>FORMING {bands.forming}</span>
      <span style={{ color: 'rgba(242,234,255,.3)' }}>·</span>
      <span style={{ color: 'rgba(242,234,255,.5)' }}>SHAKY {bands.shaky}</span>
    </div>
  );
}

/** @param {{ weakest: MasteryWeakest[] }} props */
function ReviewQueue({ weakest }) {
  const now = Date.now();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, color: C.mag, letterSpacing: '.14em' }}>REVIEW QUEUE:</div>
      {weakest.map((w) => {
        const stale = w.lastSeen != null && (now - new Date(w.lastSeen).getTime()) / MS_PER_DAY > STALE_MASTERY_DAYS;
        return (
          <div key={w.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <div style={{
              fontSize: 9.5, color: 'rgba(242,234,255,.5)', letterSpacing: '.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
            }}>
              {w.name} · {w.score}
            </div>
            {stale && (
              <div style={{ fontSize: 8, color: 'rgba(210,75,255,.55)', letterSpacing: '.08em', flexShrink: 0 }}>
                STALE
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * MEM://MASTERY block: stacked band bar + counts + weakest-concept review queue.
 * @param {{ mastery: { ok: boolean, data?: { bands: MasteryBands, total: number, weakest: MasteryWeakest[] }, error?: string }, showJp?: boolean }} props
 */
function MasteryBlock({ mastery, showJp }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>MEM://MASTERY</div>
        {showJp && <div style={{ fontFamily: fonts.jp, fontSize: 9, color: 'rgba(63,232,255,.55)' }}>記憶</div>}
      </div>
      {mastery?.ok === false ? (
        <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
          [SYS] DATA LINK LOST — CONCEPT MASTERY
        </div>
      ) : (
        <>
          <MasteryBar bands={mastery?.data?.bands ?? { solid: 0, forming: 0, shaky: 0 }} total={mastery?.data?.total ?? 0} />
          <MasteryCounts bands={mastery?.data?.bands ?? { solid: 0, forming: 0, shaky: 0 }} />
          <ReviewQueue weakest={mastery?.data?.weakest ?? []} />
        </>
      )}
    </div>
  );
}

/**
 * @typedef {{ date: string, lbs: number }} WeighIn
 */

/**
 * SYS://STATUS panel: MEM://MASTERY block, 8-stat core list (with XP mileage), weigh-in log + sparkline.
 * @param {{
 *   learning: { ok: boolean, data?: { stats: CoreStat[] }, error?: string },
 *   health: { baseline: WeighIn, weighIns: WeighIn[] },
 *   mastery: { ok: boolean, data?: { bands: MasteryBands, total: number, weakest: MasteryWeakest[] }, error?: string },
 *   byStat?: Record<string, number>,
 *   showJp?: boolean,
 *   onLogWeighIn: (lbs: number) => void,
 * }} props
 */
export function StatusPanel({ learning, health, mastery, byStat, showJp, onLogWeighIn }) {
  const [wIn, setWIn] = useState('');

  const weighIns = health?.weighIns ?? [];
  const baseline = health?.baseline;
  const latest = weighIns.at(-1);
  const delta = latest && baseline ? latest.lbs - baseline.lbs : null;
  const generalMileage = byStat?.GENERAL ?? 0;

  const handleLog = () => {
    const val = parseFloat(wIn);
    if (Number.isFinite(val) && val > 0) {
      onLogWeighIn(val);
    }
    setWIn('');
  };

  return (
    <div data-fx-panel style={panelStyle}>
      <SectionTitle jp="ステータス" showJp={showJp}>SYS://STATUS</SectionTitle>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <MasteryBlock mastery={mastery} showJp={showJp} />

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>CORE STATS</div>
          {learning?.ok === false ? (
            <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
              [SYS] DATA LINK LOST — REPORT CARD
            </div>
          ) : (
            (learning?.data?.stats ?? []).map((st) => <StatRow key={st.name} stat={st} mileage={byStat?.[st.name]} />)
          )}
          {generalMileage > 0 && (
            <div style={{ fontSize: 9, color: 'rgba(242,234,255,.4)', letterSpacing: '.06em' }}>
              GENERAL MILEAGE · +{generalMileage} XP
            </div>
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
