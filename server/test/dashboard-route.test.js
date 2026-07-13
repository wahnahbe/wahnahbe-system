import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';
import { writeStateFile } from '../state/io.js';

describe('GET /api/dashboard', () => {
  it('aggregates vault sources, state, and xp', async () => {
    const env = makeFixtureEnv();
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(res.body.ok).toBe(true);
    expect(d.learning.ok).toBe(true);
    expect(d.learning.data.totalXp).toBe(249);
    expect(d.japanese.data.level).toBe('N5');
    expect(d.tutor.mastery.data.bands.solid).toBe(1);
    expect(d.tutor.mastery.data.weakest).toHaveLength(3);
    expect(d.tutor.mastery.data.weakest[0]).toMatchObject({ name: 'RDD — formal / equation', score: 40 });
    expect(d.activity.data[0].kind).toBe('teach');
    expect(d.health.weighIns[0].lbs).toBe(200.0);
    expect(d.xp).toMatchObject({ total: 249, level: 4, name: 'Engineer' });
    expect(d.momentum).toBe(0);
  });

  it('sums xp.byStat from ledger entries, omitting zero and absent stats', async () => {
    const env = makeFixtureEnv();
    writeStateFile(env.stateDir, 'xpLedger', {
      entries: [
        { ts: 't1', amount: 20, stat: 'Conceptual', reason: 'r', source: 's' },
        { ts: 't2', amount: 15, stat: 'Conceptual', reason: 'r', source: 's' },
        { ts: 't3', amount: 10, stat: 'GENERAL', reason: 'r', source: 's' },
        { ts: 't4', amount: 5, stat: 'Mathematical', reason: 'r', source: 's' },
        { ts: 't5', amount: -5, stat: 'Mathematical', reason: 'r', source: 's' },
      ],
      crossings: [],
    });
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.body.data.xp.byStat).toEqual({ Conceptual: 35, GENERAL: 10 });
  });

  it('degrades a missing source without failing the request', async () => {
    const env = makeFixtureEnv();
    fs.rmSync(env.config.sources.jpProgress);
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.japanese.ok).toBe(false);
    expect(res.body.data.japanese.error).toBeTruthy();
    expect(res.body.data.learning.ok).toBe(true);
  });

  it('degrades xp to ledger-only when report card unreadable', async () => {
    const env = makeFixtureEnv();
    fs.writeFileSync(env.config.sources.reportCard, '# gutted');
    const res = await request(createApp(env.config)).get('/api/dashboard');
    expect(res.body.data.learning.ok).toBe(false);
    expect(res.body.data.xp).toMatchObject({ total: 0, degraded: true });
  });
});
