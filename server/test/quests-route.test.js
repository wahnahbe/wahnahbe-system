import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';
import { readStateFile, writeStateFile, DEFAULTS } from '../state/io.js';

let env, app;
beforeEach(() => { env = makeFixtureEnv(); app = createApp(env.config); });

describe('daily quests', () => {
  it('completes a daily once, awards XP to the ledger', async () => {
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.body.ok).toBe(true);
    expect(res.body.data.award.total).toBe(249 + 15);
    const ledger = readStateFile(env.stateDir, 'xpLedger');
    expect(ledger.entries[0]).toMatchObject({ amount: 15, source: 'daily:d-train' });
    const again = await request(app).post('/api/quests/daily/d-train/complete');
    expect(again.status).toBe(409);
  });

  it('404s on unknown daily', async () => {
    expect((await request(app).post('/api/quests/daily/nope/complete')).status).toBe(404);
  });

  it('does not persist completion when the award cannot be written', async () => {
    // Initialize the ledger to a valid state
    writeStateFile(env.stateDir, 'xpLedger', { entries: [], crossings: [] });
    // Corrupt the ledger file so awardXp will fail when trying to read/write
    fs.writeFileSync(path.join(env.stateDir, 'xpLedger.json'), '{ corrupt');
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.status).toBe(500);
    const quests = readStateFile(env.stateDir, 'quests');
    // Completion should NOT be persisted when award fails
    expect(quests.completions).toEqual({});
  });
});

describe('side quests', () => {
  it('adds, completes (awards), and deletes', async () => {
    const add = await request(app).post('/api/quests/side')
      .send({ title: 'SHIP DASHBOARD', xp: 25, stat: 'Programming & Implementation' });
    const id = add.body.data.quests.sides[0].id;
    const done = await request(app).post(`/api/quests/side/${id}/complete`);
    expect(done.body.data.quests.sides[0].done).toBe(true);
    expect(done.body.data.award.total).toBe(274);
    const del = await request(app).delete(`/api/quests/side/${id}`);
    expect(del.body.data.quests.sides).toHaveLength(0);
  });

  it('rejects invalid xp tier', async () => {
    const res = await request(app).post('/api/quests/side').send({ title: 'X', xp: 7, stat: 'GENERAL' });
    expect(res.status).toBe(400);
  });
});

describe('main quests + daily config', () => {
  it('updates main quest pct', async () => {
    const quests = { ...DEFAULTS.quests, mains: [{ id: 'm1', title: 'RECOMP ARC', desc: '', deadline: '', pct: 10 }] };
    writeStateFile(env.stateDir, 'quests', quests);
    const res = await request(app).patch('/api/quests/main/m1').send({ pct: 45 });
    expect(res.body.data.quests.mains[0].pct).toBe(45);
  });

  it('replaces daily definitions', async () => {
    const res = await request(app).put('/api/quests/dailies')
      .send({ dailies: [{ title: 'GYM', xp: 20, stat: 'GENERAL' }] });
    expect(res.body.data.quests.dailies).toHaveLength(1);
    expect(res.body.data.quests.dailies[0].id).toBeTruthy();
  });
});

describe('ascension', () => {
  it('records a level crossing once', async () => {
    writeStateFile(env.stateDir, 'xpLedger', {
      entries: [{ ts: 't', amount: 145, stat: 'GENERAL', reason: 'seed', source: 'test' }],
      crossings: [],
    }); // total = 394; +15 crosses 400 → level 5
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.body.data.award.ascended).toBe(5);
    const ledger = readStateFile(env.stateDir, 'xpLedger');
    expect(ledger.crossings).toEqual([{ level: 5, ts: expect.any(String) }]);
  });

  it('does not re-record a crossing already in the ledger', async () => {
    writeStateFile(env.stateDir, 'xpLedger', {
      entries: [{ ts: 't', amount: 160, stat: 'GENERAL', reason: 'seed', source: 'test' }],
      crossings: [{ level: 5, ts: 't' }],
    }); // total = 409, already level 5 and recorded
    const res = await request(app).post('/api/quests/daily/d-train/complete');
    expect(res.body.data.award.ascended).toBeNull();
    const ledger = readStateFile(env.stateDir, 'xpLedger');
    expect(ledger.crossings).toEqual([{ level: 5, ts: 't' }]);
  });
});
