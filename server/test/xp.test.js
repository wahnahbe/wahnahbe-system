import { describe, it, expect } from 'vitest';
import { LEVELS, totalXp, levelInfo, newCrossings, momentum, localDateStr } from '../xp.js';

describe('xp engine', () => {
  it('level table mirrors the report card', () => {
    expect(LEVELS.map((l) => l.min)).toEqual([0, 40, 120, 240, 400]);
    expect(LEVELS[3].name).toBe('Engineer');
  });

  it('totalXp adds report XP and ledger entries', () => {
    expect(totalXp(249, { entries: [{ amount: 15 }, { amount: 10 }], crossings: [] })).toBe(274);
    expect(totalXp(249, { entries: [], crossings: [] })).toBe(249);
  });

  it('levelInfo computes level and progress', () => {
    expect(levelInfo(249)).toEqual({ level: 4, name: 'Engineer', xpIntoLevel: 9, xpForNext: 160, pct: 6 });
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(450)).toMatchObject({ level: 5, xpForNext: null, pct: 100 });
  });

  it('newCrossings detects threshold crossings not already recorded', () => {
    const ledger = { entries: [], crossings: [{ level: 4, ts: 'x' }] };
    expect(newCrossings(230, 250, ledger)).toEqual([]);           // 4 already recorded
    expect(newCrossings(390, 405, ledger)).toEqual([5]);
    expect(newCrossings(30, 130, { entries: [], crossings: [] })).toEqual([2, 3]);
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
