import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

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
    expect(d.activity.data[0].kind).toBe('teach');
    expect(d.health.weighIns[0].lbs).toBe(200.0);
    expect(d.xp).toMatchObject({ total: 249, level: 4, name: 'Engineer' });
    expect(d.momentum).toBe(0);
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
