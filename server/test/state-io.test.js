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
    expect(health.hp).toBe(100);
    expect(health.weighIns[0]).toEqual({ date: '2026-04-01', lbs: 200.0 });
  });

  it('round-trips a valid write atomically (no tmp left behind)', () => {
    const next = { ...DEFAULTS.health, hp: 62 };
    writeStateFile(dir, 'health', next);
    expect(readStateFile(dir, 'health').hp).toBe(62);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects invalid data and leaves the old file intact', () => {
    writeStateFile(dir, 'health', DEFAULTS.health);
    expect(() => writeStateFile(dir, 'health', { hp: 'high' })).toThrow(/validation failed/);
    expect(readStateFile(dir, 'health').hp).toBe(100);
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
});
