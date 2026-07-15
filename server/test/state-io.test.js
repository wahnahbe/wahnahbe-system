import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readStateFile, writeStateFile, DEFAULTS } from '../state/io.js';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-')); });

describe('state io', () => {
  it('returns seeded defaults when file missing', () => {
    const health = readStateFile(dir, 'health');
    expect(health.baseline).toEqual({ date: '2026-04-01', lbs: 200.0 });
    expect(health.weighIns[0]).toEqual({ date: '2026-04-01', lbs: 200.0 });
  });

  it('round-trips a valid write atomically (no tmp left behind)', () => {
    const next = { ...DEFAULTS.health, weighIns: [...DEFAULTS.health.weighIns, { date: '2026-05-01', lbs: 195.0 }] };
    writeStateFile(dir, 'health', next);
    expect(readStateFile(dir, 'health').weighIns).toHaveLength(2);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects invalid data and leaves the old file intact', () => {
    writeStateFile(dir, 'health', DEFAULTS.health);
    expect(() => writeStateFile(dir, 'health', { baseline: 'nope' })).toThrow(/validation failed/);
    expect(readStateFile(dir, 'health').baseline).toEqual({ date: '2026-04-01', lbs: 200.0 });
  });

  it('has schemas + defaults for all five state files', () => {
    for (const name of ['quests', 'health', 'agenda', 'xpLedger', 'settings']) {
      expect(readStateFile(dir, name)).toBeTruthy();
    }
  });

  it('throws a clear error when a state file contains corrupt JSON', () => {
    fs.writeFileSync(path.join(dir, 'health.json'), '{ not json');
    expect(() => readStateFile(dir, 'health')).toThrow(/invalid JSON in health/);
  });

  it('defaults settings.fxRank to true', () => {
    expect(readStateFile(dir, 'settings').fxRank).toBe(true);
  });
});
