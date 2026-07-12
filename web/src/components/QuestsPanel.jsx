import React, { useState } from 'react';
import { C, fonts, panelStyle } from '../theme.js';
import { SectionTitle, Bar, HudInput, HudSelect, inputStyle } from './bits.jsx';
import { STAT_ABBR } from './StatusPanel.jsx';

const STAT_NAMES = Object.keys(STAT_ABBR);
const SIDE_TIERS = [10, 25, 50];

function Divider() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg,rgba(210,75,255,.5),transparent)' }} />;
}

const addButtonStyle = {
  background: 'rgba(210,75,255,.14)', border: '1px solid rgba(210,75,255,.55)', color: C.cyan,
  fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: fonts.mono,
};

/**
 * @typedef {{ id: string, title: string, xp: number, stat: string }} DailyQuest
 * @typedef {{ id: string, title: string, xp: number, stat: string, done: boolean, createdAt: string }} SideQuest
 * @typedef {{ id: string, title: string, desc?: string, deadline?: string, pct: number }} MainQuest
 */

/** @param {{ quest: DailyQuest, done: boolean, onComplete: () => void }} props */
function DailyCard({ quest, done, onComplete }) {
  const borderCol = done ? 'rgba(210,75,255,.18)' : 'rgba(210,75,255,.4)';
  const titleColor = done ? 'rgba(63,232,255,.45)' : '#F2EAFF';
  const abbr = STAT_ABBR[quest.stat] ?? 'GEN';
  return (
    <div style={{
      border: `1px solid ${borderCol}`, background: 'rgba(16,9,30,.55)', padding: '10px 13px',
      display: 'flex', flexDirection: 'column', gap: 8,
      clipPath: 'polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 12, letterSpacing: '.05em', color: titleColor }}>{quest.title}</div>
        <div style={{
          fontSize: 9.5, color: C.cyan, border: '1px solid rgba(210,75,255,.35)', padding: '2px 7px',
          whiteSpace: 'nowrap',
        }}>
          +{quest.xp} XP → {abbr}
        </div>
      </div>
      {done ? (
        <div style={{ fontSize: 10, color: C.cyan, letterSpacing: '.14em' }}>[COMPLETE] ✓ XP AWARDED</div>
      ) : (
        <button onClick={onComplete} style={{
          alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(210,75,255,.5)', color: C.mag,
          fontSize: 10, letterSpacing: '.18em', padding: '5px 16px', cursor: 'pointer',
          clipPath: 'polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)', fontFamily: fonts.mono,
        }}>
          ▸ EXECUTE
        </button>
      )}
    </div>
  );
}

/** @param {{ quest: SideQuest, onComplete: () => void, onDelete: () => void }} props */
function SideRow({ quest, onComplete, onDelete }) {
  const abbr = STAT_ABBR[quest.stat] ?? 'GEN';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(210,75,255,.22)',
      background: 'rgba(16,9,30,.45)', padding: '7px 11px',
    }}>
      <button onClick={onComplete} style={{
        width: 16, height: 16, flex: 'none', background: quest.done ? C.cyan : 'rgba(11,7,22,.9)',
        border: '1px solid rgba(210,75,255,.6)', cursor: 'pointer', padding: 0, color: '#08050F',
        fontSize: 11, lineHeight: 1,
      }}>
        {quest.done ? '✓' : ''}
      </button>
      <div style={{
        flex: 1, fontSize: 11.5, letterSpacing: '.04em',
        color: quest.done ? 'rgba(242,234,255,.4)' : C.text,
        textDecoration: quest.done ? 'line-through' : 'none',
      }}>
        {quest.title}
      </div>
      <div style={{ fontSize: 9, color: C.cyan, border: '1px solid rgba(210,75,255,.3)', padding: '1px 6px' }}>
        +{quest.xp} XP → {abbr}
      </div>
      <button onClick={onDelete} style={{
        background: 'none', border: 'none', color: 'rgba(63,232,255,.5)', fontSize: 13, cursor: 'pointer',
        padding: '0 2px',
      }}>
        ×
      </button>
    </div>
  );
}

/** @param {{ quest: MainQuest, localPct: number|undefined, onSliderChange: (pct: number) => void, onCommit: () => void }} props */
function MainCard({ quest, localPct, onSliderChange, onCommit }) {
  const pct = localPct ?? quest.pct;
  return (
    <div style={{
      border: '1px solid rgba(210,75,255,.3)', background: 'rgba(16,9,30,.5)', padding: '10px 13px',
      display: 'flex', flexDirection: 'column', gap: 7,
      clipPath: 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 14, letterSpacing: '.1em', color: C.text }}>
          {quest.title}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(63,232,255,.6)', whiteSpace: 'nowrap' }}>
          DL: {quest.deadline || '—'}
        </div>
      </div>
      {quest.desc && (
        <div style={{ fontSize: 9.5, color: 'rgba(63,232,255,.55)', letterSpacing: '.06em' }}>{quest.desc}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 10, alignItems: 'center' }}>
        <Bar pct={pct} flat />
        <div style={{ fontSize: 11, color: C.cyan, textAlign: 'right' }}>{pct}%</div>
      </div>
      <input
        type="range" min="0" max="100" step="1" value={pct}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit} onBlur={onCommit}
        style={{ width: '100%', margin: 0, cursor: 'pointer' }}
      />
    </div>
  );
}

/**
 * QST://QUESTS panel: dailies, side quests, main quest arcs.
 * @param {{
 *   quests: { dailies: DailyQuest[], completions: Record<string, string[]>, sides: SideQuest[], mains: MainQuest[] },
 *   today: string,
 *   showJp?: boolean,
 *   onCompleteDaily: (id: string) => void,
 *   onAddSide: (v: { title: string, xp: number, stat: string }) => void,
 *   onCompleteSide: (id: string) => void,
 *   onDeleteSide: (id: string) => void,
 *   onAddMain: (v: { title: string, deadline: string }) => void,
 *   onMainPct: (id: string, pct: number) => void,
 * }} props
 */
export function QuestsPanel({
  quests, today, showJp, onCompleteDaily, onAddSide, onCompleteSide, onDeleteSide, onAddMain, onMainPct,
}) {
  const [sideTitle, setSideTitle] = useState('');
  const [sideStat, setSideStat] = useState(STAT_NAMES[0]);
  const [sideTier, setSideTier] = useState(String(SIDE_TIERS[0]));
  const [mainTitle, setMainTitle] = useState('');
  const [mainDeadline, setMainDeadline] = useState('');
  const [mainPctLocal, setMainPctLocal] = useState({});

  const dailies = quests?.dailies ?? [];
  const sides = quests?.sides ?? [];
  const mains = quests?.mains ?? [];
  const completedToday = quests?.completions?.[today] ?? [];
  const doneCount = dailies.filter((d) => completedToday.includes(d.id)).length;

  const handleSideAdd = () => {
    if (!sideTitle.trim()) return;
    onAddSide({ title: sideTitle.trim(), xp: Number(sideTier), stat: sideStat });
    setSideTitle('');
  };

  const handleMainAdd = () => {
    if (!mainTitle.trim()) return;
    onAddMain({ title: mainTitle.trim(), deadline: mainDeadline });
    setMainTitle('');
    setMainDeadline('');
  };

  const handleMainCommit = (id) => {
    const pct = mainPctLocal[id];
    if (pct !== undefined) onMainPct(id, pct);
  };

  return (
    <div style={panelStyle}>
      <SectionTitle jp="クエスト" showJp={showJp}>QST://QUESTS</SectionTitle>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>QST://DAILY — RESET 00:00</div>
            <div style={{ fontSize: 10, color: C.cyan }}>{doneCount}/{dailies.length}</div>
          </div>
          {dailies.map((q) => (
            <DailyCard key={q.id} quest={q} done={completedToday.includes(q.id)}
              onComplete={() => onCompleteDaily(q.id)} />
          ))}
        </div>

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>QST://SIDE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 74px 64px 34px', gap: 7 }}>
            <HudInput value={sideTitle} onChange={(e) => setSideTitle(e.target.value)}
              placeholder="NEW OBJECTIVE…" style={{ minWidth: 0, fontSize: 11 }} />
            <HudSelect value={sideStat} onChange={(e) => setSideStat(e.target.value)} style={{ fontSize: 10, padding: '5px 4px' }}>
              {STAT_NAMES.map((name) => <option key={name} value={name}>{STAT_ABBR[name]}</option>)}
              <option value="GENERAL">GEN</option>
            </HudSelect>
            <HudSelect value={sideTier} onChange={(e) => setSideTier(e.target.value)} style={{ fontSize: 10, padding: '5px 4px' }}>
              {SIDE_TIERS.map((t) => <option key={t} value={t}>+{t}</option>)}
            </HudSelect>
            <button onClick={handleSideAdd} style={addButtonStyle}>+</button>
          </div>
          {sides.length === 0 ? (
            <div style={{ fontSize: 10, color: 'rgba(63,232,255,.45)', letterSpacing: '.08em', padding: '8px 2px' }}>
              [NOTIFICATION] No active side quests. Awaiting input.
            </div>
          ) : (
            sides.map((s) => (
              <SideRow key={s.id} quest={s} onComplete={() => onCompleteSide(s.id)} onDelete={() => onDeleteSide(s.id)} />
            ))
          )}
        </div>

        <Divider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 6 }}>
          <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>QST://MAIN — LONG ARC</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 34px', gap: 7 }}>
            <HudInput value={mainTitle} onChange={(e) => setMainTitle(e.target.value)}
              placeholder="NEW ARC…" style={{ minWidth: 0, fontSize: 11 }} />
            <input type="date" value={mainDeadline} onChange={(e) => setMainDeadline(e.target.value)}
              style={{ ...inputStyle, minWidth: 0, fontSize: 10 }} />
            <button onClick={handleMainAdd} style={addButtonStyle}>+</button>
          </div>
          {mains.map((m) => (
            <MainCard key={m.id} quest={m} localPct={mainPctLocal[m.id]}
              onSliderChange={(pct) => setMainPctLocal((prev) => ({ ...prev, [m.id]: pct }))}
              onCommit={() => handleMainCommit(m.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
