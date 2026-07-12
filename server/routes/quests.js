import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readStateFile, writeStateFile } from '../state/io.js';
import { StatTag } from '../state/schemas.js';
import { awardXp } from '../awards.js';
import { localDateStr } from '../xp.js';

const fail = (res, status, error) => res.status(status).json({ ok: false, error });

export function questsRouter(config) {
  const r = Router();
  const load = () => readStateFile(config.stateDir, 'quests');
  const save = (q) => writeStateFile(config.stateDir, 'quests', q);

  r.post('/quests/daily/:id/complete', (req, res) => {
    const q = load();
    const daily = q.dailies.find((d) => d.id === req.params.id);
    if (!daily) return fail(res, 404, `no daily ${req.params.id}`);
    const today = localDateStr();
    const doneToday = q.completions[today] ?? [];
    if (doneToday.includes(daily.id)) return fail(res, 409, 'already completed today');
    const award = awardXp(config, {
      amount: daily.xp, stat: daily.stat, reason: daily.title, source: `daily:${daily.id}`,
    });
    const quests = save({ ...q, completions: { ...q.completions, [today]: [...doneToday, daily.id] } });
    res.json({ ok: true, data: { quests, award } });
  });

  const SideBody = z.object({ title: z.string().min(1), xp: z.union([z.literal(10), z.literal(25), z.literal(50)]), stat: StatTag });
  r.post('/quests/side', (req, res) => {
    const body = SideBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    const side = { id: randomUUID(), ...body.data, done: false, createdAt: new Date().toISOString() };
    res.json({ ok: true, data: { quests: save({ ...q, sides: [...q.sides, side] }) } });
  });

  r.post('/quests/side/:id/complete', (req, res) => {
    const q = load();
    const side = q.sides.find((s) => s.id === req.params.id);
    if (!side) return fail(res, 404, 'no such side quest');
    if (side.done) return fail(res, 409, 'already complete');
    const award = awardXp(config, { amount: side.xp, stat: side.stat, reason: side.title, source: `side:${side.id}` });
    const quests = save({ ...q, sides: q.sides.map((s) => (s.id === side.id ? { ...s, done: true } : s)) });
    res.json({ ok: true, data: { quests, award } });
  });

  r.delete('/quests/side/:id', (req, res) => {
    const q = load();
    if (!q.sides.some((s) => s.id === req.params.id)) return fail(res, 404, 'no such side quest');
    res.json({ ok: true, data: { quests: save({ ...q, sides: q.sides.filter((s) => s.id !== req.params.id) }) } });
  });

  r.patch('/quests/main/:id', (req, res) => {
    const body = z.object({ pct: z.number().min(0).max(100) }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    if (!q.mains.some((m) => m.id === req.params.id)) return fail(res, 404, 'no such main quest');
    const quests = save({ ...q, mains: q.mains.map((m) => (m.id === req.params.id ? { ...m, pct: body.data.pct } : m)) });
    res.json({ ok: true, data: { quests } });
  });

  r.put('/quests/dailies', (req, res) => {
    const body = z.object({ dailies: z.array(z.object({
      id: z.string().optional(), title: z.string().min(1), xp: z.number().int().positive(), stat: StatTag,
    })) }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const q = load();
    const dailies = body.data.dailies.map((d) => ({ ...d, id: d.id ?? randomUUID() }));
    res.json({ ok: true, data: { quests: save({ ...q, dailies }) } });
  });

  return r;
}
