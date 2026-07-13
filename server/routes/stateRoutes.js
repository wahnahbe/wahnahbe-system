import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readStateFile, writeStateFile } from '../state/io.js';
import { schemas, StatTag } from '../state/schemas.js';
import { awardXp } from '../awards.js';
import { localDateStr } from '../xp.js';

const fail = (res, status, error) => res.status(status).json({ ok: false, error });

export function stateRouter(config) {
  const r = Router();
  const rw = (name, fn) => {
    const cur = readStateFile(config.stateDir, name);
    return writeStateFile(config.stateDir, name, fn(cur));
  };

  r.post('/health/weighins', (req, res) => {
    const body = z.object({ lbs: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const entry = { lbs: body.data.lbs, date: body.data.date ?? localDateStr() };
    const health = rw('health', (h) => ({
      ...h,
      weighIns: [...h.weighIns.filter((w) => w.date !== entry.date), entry]
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    res.json({ ok: true, data: { health } });
  });

  r.delete('/health/weighins/:date', (req, res) => {
    const cur = readStateFile(config.stateDir, 'health');
    if (!cur.weighIns.some((w) => w.date === req.params.date)) return fail(res, 404, 'no weigh-in on that date');
    const health = writeStateFile(config.stateDir, 'health', {
      ...cur, weighIns: cur.weighIns.filter((w) => w.date !== req.params.date),
    });
    res.json({ ok: true, data: { health } });
  });

  r.post('/agenda', (req, res) => {
    const body = schemas.agenda.shape.events.element
      .omit({ id: true, source: true, gcalId: true }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const event = { id: randomUUID(), source: 'manual', ...body.data };
    res.json({ ok: true, data: { agenda: rw('agenda', (a) => ({ events: [...a.events, event] })) } });
  });

  r.delete('/agenda/:id', (req, res) => {
    const cur = readStateFile(config.stateDir, 'agenda');
    if (!cur.events.some((e) => e.id === req.params.id)) return fail(res, 404, 'no such event');
    res.json({ ok: true, data: { agenda: writeStateFile(config.stateDir, 'agenda', {
      events: cur.events.filter((e) => e.id !== req.params.id),
    }) } });
  });

  r.put('/settings', (req, res) => {
    const body = schemas.settings.safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    res.json({ ok: true, data: { settings: writeStateFile(config.stateDir, 'settings', body.data) } });
  });

  r.post('/xp/award', (req, res) => {
    const body = z.object({
      amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 500, 'amount must be nonzero, |amount| <= 500'),
      stat: StatTag, reason: z.string().min(1), source: z.string().default('manual'),
    }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    res.json({ ok: true, data: { award: awardXp(config, body.data) } });
  });

  r.post('/quests/main', (req, res) => {
    const body = z.object({
      title: z.string().min(1), desc: z.string().default(''),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
    }).safeParse(req.body);
    if (!body.success) return fail(res, 400, body.error.message);
    const main = { id: randomUUID(), pct: 0, ...body.data };
    res.json({ ok: true, data: { quests: rw('quests', (q) => ({ ...q, mains: [...q.mains, main] })) } });
  });

  return r;
}
