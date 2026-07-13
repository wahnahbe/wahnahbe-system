import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseJpProgress } from '../parsers/jpProgress.js';
import { parseWikiLog } from '../parsers/wikiLog.js';
import { parseGradebook, parseConceptMastery } from '../parsers/tutorFiles.js';

const fx = (f) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8');

describe('parseJpProgress', () => {
  it('reads frontmatter and averages rolling comp', () => {
    const r = parseJpProgress(fx('progress.md'));
    expect(r).toMatchObject({ level: 'N5', streak: 14, lastSession: '2026-06-11', paused: false });
    expect(r.rollingAvg).toBeCloseTo(0.9, 2);
  });

  it('throws when last_session is missing', () => {
    expect(() => parseJpProgress('---\ncurrent_level: N5\nstreak: 3\n---\nbody')).toThrow(/last_session/);
  });

  it('throws on a non-numeric rolling_comp entry', () => {
    expect(() => parseJpProgress('---\ncurrent_level: N5\nlast_session: 2026-06-11\nrolling_comp: [1.0, oops]\n---\nbody')).toThrow(/rolling_comp/);
  });

  it('parses quoted string booleans for paused correctly', () => {
    const r = parseJpProgress('---\ncurrent_level: N5\nlast_session: 2026-06-11\npaused: "false"\n---\nbody');
    expect(r.paused).toBe(false);
  });
});

describe('parseWikiLog', () => {
  it('returns newest-first entries with kind and truncated title', () => {
    const r = parseWikiLog(fx('log.md'), 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-07-10', kind: 'teach', title: 'Causal Wk10 fixed effects guided lesson' });
    expect(r[1].kind).toBe('ingest');
  });
});

describe('parseGradebook', () => {
  it('returns graded entries newest-first, skipping ungraded headers', () => {
    const r = parseGradebook(fx('gradebook.md'), 5);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-06-24', concept: 'Best-fit line & slope', pct: 92 });
  });
});

describe('parseConceptMastery', () => {
  it('counts mastery bands and total', () => {
    const r = parseConceptMastery(fx('concept-mastery.md'));
    expect(r.bands).toEqual({ solid: 1, forming: 2, shaky: 1 });
    expect(r.total).toBe(4);
  });

  it('returns the N weakest concepts ascending by score', () => {
    const r = parseConceptMastery(fx('concept-mastery.md'), 3);
    expect(r.weakest).toEqual([
      { name: 'RDD — formal / equation', score: 40, band: 'shaky', lastSeen: '2026-06-01' },
      { name: 'IV / 2SLS estimator', score: 76, band: 'forming', lastSeen: '2026-06-27' },
      { name: 'Best-fit line & slope', score: 81, band: 'forming', lastSeen: '2026-06-24' },
    ]);
  });

  it('defaults weakestN to 3', () => {
    const r = parseConceptMastery(fx('concept-mastery.md'));
    expect(r.weakest).toHaveLength(3);
  });

  it('returns all rows, ascending, when N exceeds available rows', () => {
    const r = parseConceptMastery(fx('concept-mastery.md'), 10);
    expect(r.weakest.map((w) => w.score)).toEqual([40, 76, 81, 83]);
  });

  it('breaks ties in document order', () => {
    const md = [
      '| Concept | Level | Score | Last seen | Notes |',
      '|---|---|---|---|---|',
      '| A | solid | 50 | 2026-01-01 | n |',
      '| B | forming | 50 | 2026-01-02 | n |',
      '| C | shaky | 20 | 2026-01-03 | n |',
    ].join('\n');
    const r = parseConceptMastery(md, 3);
    expect(r.weakest.map((w) => w.name)).toEqual(['C', 'A', 'B']);
  });
});
