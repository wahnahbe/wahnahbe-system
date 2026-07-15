import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { HeaderTicker } from '../src/components/HeaderTicker.jsx';
import { AgendaStrip } from '../src/components/AgendaStrip.jsx';
import { StatusPanel } from '../src/components/StatusPanel.jsx';
import { sparkPath } from '../src/components/Sparkline.jsx';
import { QuestsPanel } from '../src/components/QuestsPanel.jsx';
import { SkillsPanel } from '../src/components/SkillsPanel.jsx';
import { radarPoints } from '../src/components/Radar.jsx';
import { SettingsDrawer } from '../src/components/SettingsDrawer.jsx';
import { rankTheme } from '../src/rankTheme.js';
import { RankInsignia } from '../src/components/RankInsignia.jsx';
import App from '../src/App.jsx';

afterEach(cleanup);

const xp = { total: 249, level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 };
const settings = { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: false };

it('HeaderTicker shows level, xp label, title', () => {
  render(<HeaderTicker xp={xp} momentum={21} settings={settings}
    onOpenSettings={() => {}} onToggleMotion={() => {}} />);
  expect(screen.getByText('WAHNAHBE')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText(/9 \/ 160 XP/)).toBeTruthy();
});

it('rankTheme accumulates fx and assigns accent tiers', () => {
  expect(rankTheme(1).fx).toEqual([]);
  expect(rankTheme(4).fx).toEqual(['panelFocus', 'energyFlow', 'ringDraw']);
  expect(rankTheme(10).fx).toHaveLength(9);
  expect(rankTheme(14).fx).toHaveLength(9);          // star tiers add no new fx
  expect(rankTheme(5).accentTier).toBe('base');
  expect(rankTheme(7).accentTier).toBe('violet');
  expect(rankTheme(8).accentTier).toBe('spectral');
  expect(rankTheme(9).accentTier).toBe('gilded');
  expect(rankTheme(12).accentTier).toBe('monarch');
});

it('RankInsignia renders an svg with a star badge past level 10', () => {
  const { container, rerender } = render(<RankInsignia level={4} size={18} />);
  expect(container.querySelector('[data-testid="rank-insignia"]')).toBeTruthy();
  rerender(<RankInsignia level={12} size={18} />);
  expect(screen.getByText('★3')).toBeTruthy();
});

it('HeaderTicker shows the rank insignia', () => {
  render(<HeaderTicker xp={xp} momentum={21} settings={settings}
    onOpenSettings={() => {}} onToggleMotion={() => {}} />);
  expect(document.querySelector('[data-testid="rank-insignia"]')).toBeTruthy();
});

it('AgendaStrip shows empty state and upcoming count', () => {
  const agenda = { events: [
    { id: '1', date: '2026-07-12', time: '09:00', title: 'LECTURE', type: 'SCHOOL', source: 'manual' },
  ] };
  render(<AgendaStrip agenda={agenda} today="2026-07-11" onAdd={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText(/NO SCHEDULED EVENTS TODAY/)).toBeTruthy();
  expect(screen.getByText('+1 UPCOMING')).toBeTruthy();
});

it('AgendaStrip defaults the time field so + works out of the box, and blocks empty title', () => {
  const onAdd = vi.fn();
  const agenda = { events: [] };
  const { container } = render(<AgendaStrip agenda={agenda} today="2026-07-11" onAdd={onAdd} onDelete={vi.fn()} />);
  const timeInput = container.querySelector('input[type="time"]');
  expect(timeInput.value).toBe('09:00');
  screen.getByText('+').click();
  expect(onAdd).not.toHaveBeenCalled();
});

const learning = { ok: true, data: { stats: [
  { name: 'Conceptual', average: 4.1, status: 'Strong' },
  { name: 'Mathematical', average: 3.0, status: 'Developing' },
  { name: 'Statistical & Data Reasoning', average: 4.7, status: 'Mastery' },
  { name: 'Programming & Implementation', average: 3.3, status: 'Developing' },
  { name: 'Software Eng. & Systems', average: null, status: 'Not yet assessed' },
  { name: 'Applied Problem-Solving', average: 4.0, status: 'Strong' },
  { name: 'Communication & Translation', average: 3.5, status: 'Strong' },
  { name: 'Retention & Connections', average: 3.6, status: 'Strong' },
], totalXp: 249, entries: [] } };

const emptyMastery = { ok: true, data: { bands: { solid: 0, forming: 0, shaky: 0 }, total: 0, weakest: [] } };

it('StatusPanel renders 8 stats and weigh-in delta', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 },
    weighIns: [{ date: '2026-04-01', lbs: 200.0 }, { date: '2026-07-01', lbs: 194.6 }] };
  render(<StatusPanel learning={learning} health={health} mastery={emptyMastery} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.getByText(/Conceptual ·/)).toBeTruthy();
  expect(screen.getByText('194.6')).toBeTruthy();
  expect(screen.getByText(/Δ -5.4 FROM BASELINE/)).toBeTruthy();
});

it('StatusPanel degrades when report card unreadable', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  render(<StatusPanel learning={{ ok: false, error: 'x' }} health={health} mastery={emptyMastery} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.getByText(/DATA LINK LOST/)).toBeTruthy();
});

it('sparkPath scales points into the viewbox', () => {
  const { pts, last } = sparkPath([{ lbs: 220 }, { lbs: 210 }, { lbs: 215 }], 130, 44);
  expect(pts.split(' ')).toHaveLength(3);
  expect(last.x).toBe(130);
});

it('StatusPanel stat bars render with flat design variant', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 },
    weighIns: [{ date: '2026-04-01', lbs: 200.0 }, { date: '2026-07-01', lbs: 194.6 }] };
  const { container } = render(<StatusPanel learning={learning} health={health} mastery={emptyMastery} showJp onLogWeighIn={vi.fn()} />);
  const flatBars = container.querySelectorAll('[data-flat="1"]');
  expect(flatBars).toHaveLength(8);
});

it('StatusPanel MasteryBlock renders bands, review queue, and a STALE tag for old concepts', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-11'));
  try {
    const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
    const mastery = { ok: true, data: {
      bands: { solid: 2, forming: 3, shaky: 1 }, total: 6,
      weakest: [
        { name: 'RDD — formal / equation', score: 40, band: 'shaky', lastSeen: '2026-06-01' }, // 40d ago -> stale
        { name: 'IV / 2SLS estimator', score: 76, band: 'forming', lastSeen: '2026-07-05' }, // 6d ago -> fresh
      ],
    } };
    render(<StatusPanel learning={learning} health={health} mastery={mastery} showJp onLogWeighIn={vi.fn()} />);
    expect(screen.getByText('MEM://MASTERY')).toBeTruthy();
    expect(screen.getByText(/SOLID 2/)).toBeTruthy();
    expect(screen.getByText(/FORMING 3/)).toBeTruthy();
    expect(screen.getByText(/SHAKY 1/)).toBeTruthy();
    expect(screen.getByText('REVIEW QUEUE:')).toBeTruthy();
    expect(screen.getByText(/RDD — formal \/ equation · 40/)).toBeTruthy();
    expect(screen.getByText(/IV \/ 2SLS estimator · 76/)).toBeTruthy();
    expect(screen.getByText('STALE')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it('StatusPanel MasteryBlock degrades independently when concept mastery is unreadable', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  render(<StatusPanel learning={learning} health={health} mastery={{ ok: false, error: 'x' }} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.getByText(/DATA LINK LOST — CONCEPT MASTERY/)).toBeTruthy();
  expect(screen.getByText(/Conceptual ·/)).toBeTruthy(); // rest of the panel still renders
});

it('StatusPanel stat rows show XP mileage and a GENERAL mileage footer, omitting zero stats', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  const byStat = { Conceptual: 30, GENERAL: 15 };
  render(<StatusPanel learning={learning} health={health} mastery={emptyMastery} byStat={byStat} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.getByText('+30xp')).toBeTruthy();
  expect(screen.getByText(/GENERAL MILEAGE · \+15 XP/)).toBeTruthy();
  expect(screen.queryByText(/^\+0xp$/)).toBeNull();
});

it('StatusPanel omits the GENERAL mileage footer when there is no GENERAL mileage', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  render(<StatusPanel learning={learning} health={health} mastery={emptyMastery} byStat={{}} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.queryByText(/GENERAL MILEAGE/)).toBeNull();
});

it('StatusPanel does not render mileage artifacts for negative byStat values', () => {
  const health = { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] };
  const byStat = { Conceptual: -5, GENERAL: -10 };
  render(<StatusPanel learning={learning} health={health} mastery={emptyMastery} byStat={byStat} showJp onLogWeighIn={vi.fn()} />);
  expect(screen.queryByText(/\+-/)).toBeNull();
  expect(screen.queryByText(/GENERAL MILEAGE/)).toBeNull();
});

const quests = {
  dailies: [{ id: 'd1', title: 'TRAINING', xp: 15, stat: 'GENERAL' }],
  completions: { '2026-07-11': ['d1'] },
  sides: [{ id: 's1', title: 'SHIP IT', xp: 25, stat: 'Programming & Implementation', done: false, createdAt: 't' }],
  mains: [{ id: 'm1', title: 'RECOMP ARC', desc: 'cut to 200', deadline: '2026-12-31', pct: 30 }],
};

it('QuestsPanel shows completion state, side quests, mains', () => {
  render(<QuestsPanel quests={quests} today="2026-07-11" showJp
    onCompleteDaily={vi.fn()} onAddSide={vi.fn()} onCompleteSide={vi.fn()}
    onDeleteSide={vi.fn()} onAddMain={vi.fn()} onMainPct={vi.fn()} />);
  expect(screen.getByText(/COMPLETE.*XP AWARDED/)).toBeTruthy();  // d1 done today
  expect(screen.getByText('1/1')).toBeTruthy();
  expect(screen.getByText('SHIP IT')).toBeTruthy();
  expect(screen.getByText('RECOMP ARC')).toBeTruthy();
});

it('QuestsPanel EXECUTE fires onCompleteDaily', async () => {
  const on = vi.fn();
  render(<QuestsPanel quests={{ ...quests, completions: {} }} today="2026-07-11" showJp
    onCompleteDaily={on} onAddSide={vi.fn()} onCompleteSide={vi.fn()}
    onDeleteSide={vi.fn()} onAddMain={vi.fn()} onMainPct={vi.fn()} />);
  screen.getByText(/EXECUTE/).click();
  expect(on).toHaveBeenCalledWith('d1');
});

it('radarPoints maps 8 averages to 8 svg points', () => {
  const stats = Array.from({ length: 8 }, (_, i) => ({ name: `s${i}`, average: 5, status: '' }));
  const pts = radarPoints(stats, 130, 120, 90).split(' ');
  expect(pts).toHaveLength(8);
  expect(pts[0]).toBe('130,30'); // straight up at full radius
});

it('SkillsPanel renders LANG card and feed', () => {
  // Scoped fake time: only this test needs "now" pinned for the staleness check.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-11'));
  try {
    render(<SkillsPanel learning={learning} activity={{ ok: true, data: [{ date: '2026-07-10', kind: 'teach', title: 'FE lesson' }] }}
      tutor={{ gradebook: { ok: true, data: [{ date: '2026-06-24', concept: 'Error term', pct: 78 }] }, mastery: { ok: true, data: { bands: { solid: 1, forming: 2, shaky: 1 }, total: 4 } } }}
      japanese={{ ok: true, data: { level: 'N5', streak: 14, rollingAvg: 0.9, lastSession: '2026-06-11', paused: false } }}
      showJp onTrain={vi.fn()} />);
    expect(screen.getByText('N5')).toBeTruthy();
    expect(screen.getByText(/STREAK 14/)).toBeTruthy();
    expect(screen.getByText(/FE lesson/)).toBeTruthy();
    expect(screen.getByText(/SIGNAL FADING/)).toBeTruthy(); // 2026-06-11 is >14d before pinned now
  } finally {
    vi.useRealTimers();
  }
});

it('SkillsPanel degrades radar, LANG, and feed sub-sources independently', () => {
  render(<SkillsPanel learning={{ ok: false, error: 'x' }}
    activity={{ ok: false, error: 'x' }}
    tutor={{ gradebook: { ok: false, error: 'x' }, mastery: { ok: true, data: { bands: {}, total: 0 } } }}
    japanese={{ ok: false, error: 'x' }}
    showJp onTrain={vi.fn()} />);
  expect(screen.getByText(/DATA LINK LOST — REPORT CARD/)).toBeTruthy();
  expect(screen.getByText(/DATA LINK LOST — JAPANESE VAULT/)).toBeTruthy();
  expect(screen.getAllByText(/LINK LOST/).length).toBeGreaterThanOrEqual(3);
});

it('SkillsPanel training buttons fire onTrain with S/M/L xp tiers', () => {
  const on = vi.fn();
  render(<SkillsPanel learning={learning} activity={{ ok: true, data: [] }}
    tutor={{ gradebook: { ok: true, data: [] }, mastery: { ok: true, data: { bands: {}, total: 0 } } }}
    japanese={{ ok: true, data: { level: 'N5', streak: 1, rollingAvg: 0.5, lastSession: '2026-07-10', paused: false } }}
    showJp onTrain={on} />);
  screen.getByTitle('+10 XP').click();
  screen.getByTitle('+20 XP').click();
  screen.getByTitle('+40 XP').click();
  expect(on).toHaveBeenCalledWith('Conceptual', 10);
  expect(on).toHaveBeenCalledWith('Conceptual', 20);
  expect(on).toHaveBeenCalledWith('Conceptual', 40);
});

function mockBackend(data) {
  global.EventSource = class { addEventListener() {} close() {} };
  global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data }) });
}

it('App renders all panels from dashboard data (boot skipped via reducedMotion)', async () => {
  mockBackend({
    learning, // from earlier in file
    japanese: { ok: true, data: { level: 'N5', streak: 14, rollingAvg: 0.9, lastSession: '2026-06-11', paused: false } },
    activity: { ok: true, data: [] },
    tutor: { gradebook: { ok: true, data: [] }, mastery: { ok: true, data: { bands: { solid: 0, forming: 0, shaky: 0 }, total: 0 } } },
    quests: { dailies: [], completions: {}, sides: [], mains: [] },
    health: { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] },
    agenda: { events: [] },
    settings: { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: true },
    xp: { total: 249, reportXp: 249, ledgerXp: 0, level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 },
    momentum: 0, today: '2026-07-11',
  });
  render(<App />);
  expect(await screen.findByText('WAHNAHBE')).toBeTruthy();
  expect(screen.getByText('SYS://STATUS')).toBeTruthy();
  expect(screen.getByText('QST://QUESTS')).toBeTruthy();
  expect(screen.getByText('SKL://SKILLS')).toBeTruthy();
});

it('App shows the amount actually just earned after a training click, not the lifetime total', async () => {
  const dashboard = {
    learning,
    japanese: { ok: true, data: { level: 'N5', streak: 14, rollingAvg: 0.9, lastSession: '2026-06-11', paused: false } },
    activity: { ok: true, data: [] },
    tutor: { gradebook: { ok: true, data: [] }, mastery: { ok: true, data: { bands: { solid: 0, forming: 0, shaky: 0 }, total: 0 } } },
    quests: { dailies: [], completions: {}, sides: [], mains: [] },
    health: { baseline: { date: '2026-04-01', lbs: 200.0 }, weighIns: [] },
    agenda: { events: [] },
    settings: { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: true },
    xp: { total: 249, reportXp: 249, ledgerXp: 0, level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 },
    momentum: 0, today: '2026-07-11',
  };
  const award = {
    ledger: { entries: [], crossings: [] }, total: 259, amount: 10,
    xp: { level: 4, name: 'Engineer', xpIntoLevel: 19, xpForNext: 160, pct: 12 }, ascended: null,
  };
  global.EventSource = class { addEventListener() {} close() {} };
  global.fetch = vi.fn((url, opts) => {
    if (opts?.method === 'POST' && String(url).includes('/xp/award')) {
      return Promise.resolve({ json: async () => ({ ok: true, data: { award } }) });
    }
    return Promise.resolve({ json: async () => ({ ok: true, data: dashboard }) });
  });

  render(<App />);
  expect(await screen.findByText('WAHNAHBE')).toBeTruthy();
  screen.getByTitle('+10 XP').click();
  expect(await screen.findByText('+10 XP BANKED')).toBeTruthy();
});

it('SettingsDrawer surfaces malformed-JSON import failures via onError instead of failing silently', async () => {
  const onError = vi.fn();
  const { container } = render(<SettingsDrawer open settings={settings}
    quests={{ dailies: [] }} health={{ weighIns: [] }} fullData={{}}
    onClose={vi.fn()} onSaveSettings={vi.fn()} onSaveDailies={vi.fn()} onDeleteWeighIn={vi.fn()}
    onError={onError} />);
  const fileInput = container.querySelector('input[type="file"]');
  const badFile = new File(['not valid json'], 'bad.json', { type: 'application/json' });
  fireEvent.change(fileInput, { target: { files: [badFile] } });
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('IMPORT FAILED')));
});

it('SettingsDrawer surfaces missing-keys import failures via onError instead of failing silently', async () => {
  const onError = vi.fn();
  const { container } = render(<SettingsDrawer open settings={settings}
    quests={{ dailies: [] }} health={{ weighIns: [] }} fullData={{}}
    onClose={vi.fn()} onSaveSettings={vi.fn()} onSaveDailies={vi.fn()} onDeleteWeighIn={vi.fn()}
    onError={onError} />);
  const fileInput = container.querySelector('input[type="file"]');
  const incompleteFile = new File([JSON.stringify({ settings: {} })], 'incomplete.json', { type: 'application/json' });
  fireEvent.change(fileInput, { target: { files: [incompleteFile] } });
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('IMPORT FAILED')));
});
