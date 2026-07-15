import React, { useState } from 'react';
import { C, fonts, panelStyle } from '../theme.js';
import { SectionTitle, HudSelect } from './bits.jsx';
import { STAT_ABBR } from './StatusPanel.jsx';
import { Radar } from './Radar.jsx';

const STAT_NAMES = Object.keys(STAT_ABBR);
const TRAIN_TIERS = [
  { key: 'S', xp: 10 },
  { key: 'M', xp: 20 },
  { key: 'L', xp: 40 },
];
const STALE_DAYS = 14;
const MS_PER_DAY = 86400000;
const TITLE_TRUNCATE = 60;

function Divider() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg,rgba(210,75,255,.5),transparent)' }} />;
}

function LinkLost({ label }) {
  return (
    <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
      [SYS] LINK LOST — {label}
    </div>
  );
}

const trainButtonStyle = {
  background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)', color: C.cyan,
  fontSize: 10, padding: '6px 11px', cursor: 'pointer', fontFamily: fonts.mono,
};

/**
 * SKL://LOG_TRAINING box: stat select + S/M/L xp tier buttons.
 * @param {{ onTrain: (stat: string, xp: number) => void }} props
 */
function TrainingLogger({ onTrain }) {
  const [stat, setStat] = useState(STAT_NAMES[0]);
  return (
    <div style={{
      border: '1px solid rgba(210,75,255,.35)', background: 'rgba(16,9,30,.55)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
      clipPath: 'polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)',
    }}>
      <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.18em' }}>SKL://LOG_TRAINING</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 7, alignItems: 'center' }}>
        <HudSelect value={stat} onChange={(e) => setStat(e.target.value)} style={{ minWidth: 0, fontSize: 10.5, padding: '6px 5px' }}>
          {STAT_NAMES.map((name) => <option key={name} value={name}>{STAT_ABBR[name]}</option>)}
          <option value="GENERAL">GEN</option>
        </HudSelect>
        {TRAIN_TIERS.map((t) => (
          <button key={t.key} title={`+${t.xp} XP`} onClick={() => onTrain(stat, t.xp)} style={trainButtonStyle}>
            {t.key}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 8.5, color: 'rgba(242,234,255,.4)', letterSpacing: '.06em' }}>
        S +10 / M +20 / L +40 XP · FEEDS MAPPED CORE STAT
      </div>
    </div>
  );
}

/**
 * LANG://日本語 card: level, streak, rolling comprehension, last session, staleness/paused flags.
 * @param {{ japanese: { ok: boolean, data?: { level: string, streak: number, rollingAvg: number, lastSession: string, paused?: boolean }, error?: string } }} props
 */
function LangCard({ japanese }) {
  if (japanese?.ok === false) {
    return (
      <div style={{
        border: '1px solid rgba(210,75,255,.35)', background: 'rgba(16,9,30,.55)', padding: '10px 12px',
        clipPath: 'polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)',
      }}>
        <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.18em', marginBottom: 6 }}>LANG://日本語</div>
        <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
          [SYS] DATA LINK LOST — JAPANESE VAULT
        </div>
      </div>
    );
  }

  const data = japanese?.data ?? {};
  const compPct = data.rollingAvg != null ? Math.round(data.rollingAvg * 100) : null;
  const staleDays = data.lastSession ? (Date.now() - new Date(data.lastSession).getTime()) / MS_PER_DAY : null;
  const isStale = staleDays != null && staleDays > STALE_DAYS;

  return (
    <div style={{
      border: '1px solid rgba(210,75,255,.35)', background: 'rgba(16,9,30,.55)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
      clipPath: 'polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.18em' }}>LANG://日本語</div>
        {data.paused && (
          <div style={{ fontSize: 9, color: 'rgba(63,232,255,.6)', letterSpacing: '.1em' }}>[PAUSED]</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{
          fontFamily: fonts.display, fontWeight: 700, fontSize: 26, lineHeight: 1, color: C.cyan,
          textShadow: '0 0 10px rgba(63,232,255,.4)',
        }}>
          {data.level ?? '—'}
        </div>
        <div style={{ fontSize: 10, color: C.text, letterSpacing: '.06em' }}>
          STREAK {Number.isFinite(data.streak) ? data.streak : 0}D
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(63,232,255,.7)', letterSpacing: '.06em' }}>
        COMP {compPct ?? '—'}% · LAST {data.lastSession ?? '—'}
      </div>
      {isStale && (
        <div style={{ fontSize: 9.5, color: 'rgba(63,232,255,.55)', letterSpacing: '.06em' }}>
          [SYS] SIGNAL FADING — RESUME TRAINING
        </div>
      )}
    </div>
  );
}

/** @param {string} title */
function truncateTitle(title) {
  return title.length > TITLE_TRUNCATE ? `${title.slice(0, TITLE_TRUNCATE)}…` : title;
}

/**
 * SYS://RECENT_SYNC feed: latest activity log titles + latest gradebook grades.
 * @param {{
 *   activity: { ok: boolean, data?: { date: string, kind: string, title: string }[], error?: string },
 *   gradebook: { ok: boolean, data?: { date: string, concept: string, pct: number }[], error?: string },
 * }} props
 */
function RecentSyncFeed({ activity, gradebook }) {
  const activityEntries = activity?.ok
    ? [...(activity.data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
    : [];
  const gradeEntries = gradebook?.ok
    ? [...(gradebook.data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 6 }}>
      <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>SYS://RECENT_SYNC</div>

      {activity?.ok === false ? (
        <LinkLost label="ACTIVITY" />
      ) : (
        activityEntries.map((a, i) => (
          <div key={`${a.date}-${i}`} style={{ fontSize: 10, color: 'rgba(242,234,255,.5)', letterSpacing: '.04em' }}>
            {a.date} · {(a.kind ?? '').toUpperCase()} · {truncateTitle(a.title ?? '')}
          </div>
        ))
      )}

      {gradebook?.ok === false ? (
        <LinkLost label="GRADEBOOK" />
      ) : (
        gradeEntries.map((g, i) => (
          <div key={`${g.date}-${i}`} style={{ fontSize: 10, color: C.cyan, letterSpacing: '.04em' }}>
            {g.concept} · {g.pct}%
          </div>
        ))
      )}
    </div>
  );
}

/**
 * SKL://SKILLS panel: octagon radar, training logger, LANG://日本語 card, recent sync feed.
 * @param {{
 *   learning: { ok: boolean, data?: { stats: import('./Radar.jsx').CoreStat[] }, error?: string },
 *   tutor: { gradebook: { ok: boolean, data?: any[], error?: string }, mastery?: { ok: boolean, data?: any, error?: string } },
 *   activity: { ok: boolean, data?: any[], error?: string },
 *   japanese: { ok: boolean, data?: any, error?: string },
 *   showJp?: boolean,
 *   onTrain: (stat: string, xp: number) => void,
 * }} props
 */
export function SkillsPanel({ learning, tutor, activity, japanese, showJp, onTrain }) {
  return (
    <div data-fx-panel style={panelStyle}>
      <SectionTitle jp="スキル" showJp={showJp}>SKL://SKILLS</SectionTitle>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {learning?.ok === false ? (
          <div style={{ fontSize: 10, color: 'rgba(63,232,255,.6)', letterSpacing: '.08em' }}>
            [SYS] DATA LINK LOST — REPORT CARD
          </div>
        ) : (
          <Radar stats={learning?.data?.stats ?? []} />
        )}

        <TrainingLogger onTrain={onTrain} />

        <Divider />

        <LangCard japanese={japanese} />

        <Divider />

        <RecentSyncFeed activity={activity} gradebook={tutor?.gradebook} />
      </div>
    </div>
  );
}
