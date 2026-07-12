import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseReportCard } from '../parsers/reportCard.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

const md = fixture('learning-report-card.md');

describe('parseReportCard', () => {
  it('parses the 8 stat averages, mapping — to null', () => {
    const r = parseReportCard(md);
    expect(r.stats).toHaveLength(8);
    expect(r.stats[0]).toEqual({ name: 'Conceptual', average: 4.1, status: 'Strong' });
    expect(r.stats.find((s) => s.name === 'Software Eng. & Systems').average).toBeNull();
    expect(r.stats.find((s) => s.name === 'Statistical & Data Reasoning').average).toBe(4.7);
  });

  it('parses XP, level, level name, sessions', () => {
    const r = parseReportCard(md);
    expect(r.totalXp).toBe(249);
    expect(r.level).toBe(4);
    expect(r.levelName).toBe('Engineer');
    expect(r.sessionsGraded).toBe(12);
  });

  it('parses recent entries newest-first', () => {
    const r = parseReportCard(md);
    expect(r.entries[0]).toEqual({ n: 13, date: '2026-07-10', title: 'Fixed Effects (Causal Wk10)', grade: 'A− (thin coverage)' });
    expect(r.entries[1].n).toBe(12);
  });

  it('throws on garbage input', () => {
    expect(() => parseReportCard('# nothing here')).toThrow();
  });

  it('throws on a short octagon table instead of absorbing a stray pipe-row from a later section', () => {
    const malformed = fixture('octagon-malformed-table.md');
    expect(() => parseReportCard(malformed)).toThrow(/expected 8 stats, got 7/);
  });

  it('returns entries: [] when the session log section is missing, while still parsing stats/XP', () => {
    const noLog = fixture('octagon-missing-log-section.md');
    const r = parseReportCard(noLog);
    expect(r.entries).toEqual([]);
    expect(r.stats).toHaveLength(8);
    expect(r.totalXp).toBe(249);
    expect(r.level).toBe(4);
  });
});
