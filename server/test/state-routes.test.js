import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

let env, app;
beforeEach(() => { env = makeFixtureEnv(); app = createApp(env.config); });

it('returns 404 for the removed gauge route', async () => {
  expect((await request(app).post('/api/health/gauge').send({ hp: 62 })).status).toBe(404);
});

it('logs and deletes weigh-ins, kept sorted', async () => {
  await request(app).post('/api/health/weighins').send({ lbs: 194.6, date: '2026-07-11' });
  const res = await request(app).post('/api/health/weighins').send({ lbs: 196.2, date: '2026-06-01' });
  expect(res.body.data.health.weighIns.map((w) => w.lbs)).toEqual([200.0, 196.2, 194.6]);
  const del = await request(app).delete('/api/health/weighins/2026-06-01');
  expect(del.body.data.health.weighIns).toHaveLength(2);
  expect((await request(app).delete('/api/health/weighins/1999-01-01')).status).toBe(404);
});

it('replaces an existing weigh-in for the same date instead of duplicating it', async () => {
  await request(app).post('/api/health/weighins').send({ lbs: 194.6, date: '2026-07-11' });
  const res = await request(app).post('/api/health/weighins').send({ lbs: 215.0, date: '2026-07-11' });
  const sameDate = res.body.data.health.weighIns.filter((w) => w.date === '2026-07-11');
  expect(sameDate).toHaveLength(1);
  expect(sameDate[0].lbs).toBe(215.0);
});

it('adds and deletes agenda events', async () => {
  const add = await request(app).post('/api/agenda')
    .send({ date: '2026-07-12', time: '09:30', title: 'BU LECTURE', type: 'SCHOOL' });
  const ev = add.body.data.agenda.events[0];
  expect(ev).toMatchObject({ source: 'manual', type: 'SCHOOL' });
  const del = await request(app).delete(`/api/agenda/${ev.id}`);
  expect(del.body.data.agenda.events).toHaveLength(0);
});

it('replaces settings', async () => {
  const res = await request(app).put('/api/settings')
    .send({ title: 'DATA OPERATIVE', scanlines: false, jpLabels: true, reducedMotion: false });
  expect(res.body.data.settings.scanlines).toBe(false);
});

it('awards direct XP and enforces bounds', async () => {
  const res = await request(app).post('/api/xp/award')
    .send({ amount: 20, stat: 'Programming & Implementation', reason: 'built the watcher' });
  expect(res.body.data.award.total).toBe(269);
  expect(res.body.data.award.amount).toBe(20);
  expect((await request(app).post('/api/xp/award').send({ amount: 9999, stat: 'GENERAL', reason: 'x' })).status).toBe(400);
});

it('adds a main quest at 0%', async () => {
  const res = await request(app).post('/api/quests/main').send({ title: 'RECOMP ARC', deadline: '2026-12-31' });
  expect(res.body.data.quests.mains[0]).toMatchObject({ pct: 0, title: 'RECOMP ARC' });
});
