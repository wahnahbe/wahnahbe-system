import { z } from 'zod';

const STATS = ['Conceptual', 'Mathematical', 'Statistical & Data Reasoning',
  'Programming & Implementation', 'Software Eng. & Systems', 'Applied Problem-Solving',
  'Communication & Translation', 'Retention & Connections'];
export const StatTag = z.enum([...STATS, 'GENERAL']);
export const STAT_NAMES = STATS;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const schemas = {
  quests: z.object({
    dailies: z.array(z.object({
      id: z.string(), title: z.string().min(1), xp: z.number().int().positive(), stat: StatTag,
    })),
    completions: z.record(isoDate, z.array(z.string())), // date -> daily ids done that day
    sides: z.array(z.object({
      id: z.string(), title: z.string().min(1), xp: z.number().int().positive(),
      stat: StatTag, done: z.boolean(), createdAt: z.string(),
    })),
    mains: z.array(z.object({
      id: z.string(), title: z.string().min(1), desc: z.string(), deadline: isoDate.or(z.literal('')),
      pct: z.number().min(0).max(100),
    })),
  }),
  health: z.object({
    baseline: z.object({ date: isoDate, lbs: z.number().positive() }),
    weighIns: z.array(z.object({ date: isoDate, lbs: z.number().positive() })),
  }),
  agenda: z.object({
    events: z.array(z.object({
      id: z.string(), date: isoDate, time: z.string().regex(/^\d{2}:\d{2}$/),
      title: z.string().min(1),
      type: z.enum(['SCHOOL', 'INTERVIEW', 'WORK', 'TRAINING', 'OTHER']),
      source: z.enum(['manual', 'gcal']), gcalId: z.string().optional(),
    })),
  }),
  xpLedger: z.object({
    entries: z.array(z.object({
      ts: z.string(), amount: z.number().int(), stat: StatTag,
      reason: z.string(), source: z.string(),
    })),
    crossings: z.array(z.object({ level: z.number().int(), ts: z.string() })),
  }),
  settings: z.object({
    title: z.string(),
    scanlines: z.boolean(), jpLabels: z.boolean(), reducedMotion: z.boolean(),
  }),
};
