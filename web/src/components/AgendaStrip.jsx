import React, { useState } from 'react';
import { C, fonts, clip } from '../theme.js';
import { HudInput, HudSelect } from './bits.jsx';

const TYPE_COLORS = {
  SCHOOL: C.cyan,
  INTERVIEW: C.mag,
  WORK: '#F2EAFF',
  TRAINING: '#6BFF9E',
  OTHER: C.dim,
};

const EVENT_TYPES = ['SCHOOL', 'INTERVIEW', 'WORK', 'TRAINING', 'OTHER'];

/**
 * @typedef {{ id: string, date: string, time: string, title: string, type: string, source: string }} AgendaEvent
 */

/**
 * OPS://TODAY strip: today's event chips, upcoming count, and quick-add row.
 * @param {{
 *   agenda: { events: AgendaEvent[] },
 *   today: string,
 *   onAdd: (event: { date: string, time: string, title: string, type: string }) => void,
 *   onDelete: (id: string) => void,
 * }} props
 */
export function AgendaStrip({ agenda, today, onAdd, onDelete }) {
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('SCHOOL');

  const events = agenda?.events ?? [];
  const todayEvents = events
    .filter((ev) => ev.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcomingCount = events.filter((ev) => ev.date > today).length;

  const handleAdd = () => {
    if (!title.trim() || !time) return;
    onAdd({ date, time, title, type });
    setTitle('');
    setTime('09:00');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, margin: '12px 14px 0', padding: '7px 14px',
      background: C.panel, backdropFilter: 'blur(8px)', border: '1px solid rgba(210,75,255,.4)',
      clipPath: clip(10),
      boxShadow: 'inset 0 0 20px rgba(210,75,255,.05)',
    }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 12, letterSpacing: '.2em', color: C.mag, whiteSpace: 'nowrap' }}>
        OPS://TODAY
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(210,75,255,.3)' }} />

      <div style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center', minWidth: 0 }}>
        {todayEvents.length === 0 && (
          <div style={{ fontSize: 10, color: 'rgba(242,234,255,.45)', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
            [SYS] NO SCHEDULED EVENTS TODAY. LOG ONE →
          </div>
        )}
        {todayEvents.map((ev) => {
          const border = TYPE_COLORS[ev.type] ?? TYPE_COLORS.OTHER;
          return (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${border}`,
              background: 'rgba(16,9,30,.6)', padding: '4px 10px', whiteSpace: 'nowrap', flex: 'none',
              clipPath: 'polygon(6px 0,100% 0,100% 100%,0 100%,0 6px)',
            }}>
              <span style={{ fontSize: 10, color: C.cyan }}>{ev.time}</span>
              <span style={{ fontSize: 10.5, color: C.text, letterSpacing: '.05em' }}>{ev.title}</span>
              <span style={{ fontSize: 8, color: border, border: `1px solid ${border}`, padding: '1px 5px', letterSpacing: '.14em' }}>
                {ev.type}
              </span>
              <button onClick={() => onDelete(ev.id)} style={{
                background: 'none', border: 'none', color: 'rgba(63,232,255,.45)', fontSize: 11,
                cursor: 'pointer', padding: 0,
              }}>×</button>
            </div>
          );
        })}
        {upcomingCount > 0 && (
          <div style={{ fontSize: 9, color: 'rgba(63,232,255,.55)', letterSpacing: '.12em', whiteSpace: 'nowrap', flex: 'none' }}>
            +{upcomingCount} UPCOMING
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
        <HudInput type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 9.5, padding: '4px 6px' }} />
        <HudInput type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ fontSize: 9.5, padding: '4px 6px' }} />
        <HudInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="EVENT…" style={{ width: 150 }} />
        <HudSelect value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: 9, padding: '4px 3px' }}>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </HudSelect>
        <button onClick={handleAdd} style={{
          background: 'rgba(210,75,255,.14)', border: '1px solid rgba(210,75,255,.55)', color: C.cyan,
          fontSize: 12, cursor: 'pointer', padding: '2px 10px', fontFamily: fonts.mono,
        }}>+</button>
      </div>
    </div>
  );
}
