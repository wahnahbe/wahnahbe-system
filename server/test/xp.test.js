import { describe, it, expect } from 'vitest';
import { NAMED_LEVELS, thresholdFor, totalXp, levelInfo, newCrossings, momentum, localDateStr } from '../xp.js';

describe('xp engine', () => {
  it('named ladder mirrors the spec table', () => {
    expect(NAMED_LEVELS.map((l) => l.min)).toEqual([0, 40, 120, 240, 400, 560, 760, 1000, 1300, 1650]);
    expect(NAMED_LEVELS[5].name).toBe('Architect');
    expect(NAMED_LEVELS[9].name).toBe('Monarch');
  });

  it('thresholdFor generates procedural tiers past 10', () => {
    expect(thresholdFor(10)).toBe(1650);
    expect(thresholdFor(11)).toBe(2100);          // 1650 + 450
    expect(thresholdFor(12)).toBe(2100 + 580);    // round(450*1.28/10)*10 = 580
    expect(thresholdFor(13)).toBe(2680 + 740);    // round(580*1.28/10)*10 = 740
  });

  it('totalXp adds report XP and ledger entries', () => {
    expect(totalXp(249, { entries: [{ amount: 15 }, { amount: 10 }], crossings: [] })).toBe(274);
    expect(totalXp(249, { entries: [], crossings: [] })).toBe(249);
  });

  it('levelInfo computes level and progress', () => {
    expect(levelInfo(249)).toEqual({ level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 });
    expect(levelInfo(0).level).toBe(1);
  });

  it('levelInfo has no MAX state and names star tiers', () => {
    expect(levelInfo(454)).toEqual({ level: 5, name: 'Forward-Deployed Master', xpIntoLevel: 54, xpForNext: 160, pct: 34 });
    expect(levelInfo(559).level).toBe(5);
    expect(levelInfo(560)).toMatchObject({ level: 6, name: 'Architect' });
    expect(levelInfo(1650)).toMatchObject({ level: 10, name: 'Monarch' });
    expect(levelInfo(2100)).toMatchObject({ level: 11, name: 'Monarch ★2', xpForNext: 580 });
    expect(levelInfo(2099)).toMatchObject({ level: 10, xpForNext: 450 });
  });

  it('newCrossings detects threshold crossings not already recorded', () => {
    const ledger = { entries: [], crossings: [{ level: 4, ts: 'x' }] };
    expect(newCrossings(230, 250, ledger)).toEqual([]);           // 4 already recorded
    expect(newCrossings(390, 405, ledger)).toEqual([5]);
    expect(newCrossings(30, 130, { entries: [], crossings: [] })).toEqual([2, 3]);
  });

  it('newCrossings works across procedural thresholds', () => {
    const empty = { entries: [], crossings: [] };
    expect(newCrossings(2050, 2150, empty)).toEqual([11]);
    expect(newCrossings(390, 620, empty)).toEqual([5, 6]);
    expect(newCrossings(2050, 2150, { entries: [], crossings: [{ level: 11, ts: 't' }] })).toEqual([]);
  });

  it('momentum = completed/possible over trailing 7 days', () => {
    const quests = {
      dailies: [{ id: 'a' }, { id: 'b' }],
      completions: { '2026-07-11': ['a', 'b'], '2026-07-10': ['a'] },
      sides: [], mains: [],
    };
    // 3 completions / (2 dailies * 7 days) = 21%
    expect(momentum(quests, '2026-07-11')).toBe(21);
    expect(momentum({ dailies: [], completions: {}, sides: [], mains: [] }, '2026-07-11')).toBe(0);
  });

  it('levelInfo clamps negative xp to level 1', () => {
    expect(levelInfo(-50)).toEqual({ level: 1, name: 'Apprentice', xpIntoLevel: 0, xpForNext: 40, pct: 0 });
  });

  it('momentum reaches across a month boundary', () => {
    const quests = { dailies: [{ id: 'a' }], completions: { '2026-07-30': ['a'], '2026-08-01': ['a'] }, sides: [], mains: [] };
    // window for 2026-08-03 = Jul 28 .. Aug 3 → 2 completions / 7 = 29%
    expect(momentum(quests, '2026-08-03')).toBe(29);
  });

  it('localDateStr formats YYYY-MM-DD', () => {
    expect(localDateStr(new Date(2026, 6, 11))).toBe('2026-07-11');
  });
});
