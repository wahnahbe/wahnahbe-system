import fs from 'node:fs';
import path from 'node:path';
import { schemas } from './schemas.js';

export const DEFAULTS = {
  quests: {
    dailies: [
      { id: 'd-train', title: 'TRAINING SESSION', xp: 15, stat: 'GENERAL' },
      { id: 'd-study', title: 'STUDY BLOCK', xp: 15, stat: 'Conceptual' },
      { id: 'd-code', title: 'WRITE CODE', xp: 15, stat: 'Programming & Implementation' },
    ],
    completions: {}, sides: [], mains: [],
  },
  health: {
    baseline: { date: '2026-04-01', lbs: 200.0 },
    weighIns: [{ date: '2026-04-01', lbs: 200.0 }],
  },
  agenda: { events: [] },
  xpLedger: { entries: [], crossings: [] },
  settings: { title: 'THE OPERATOR', scanlines: true, jpLabels: true, reducedMotion: false },
};

const fileOf = (dir, name) => path.join(dir, `${name}.json`);

export function readStateFile(stateDir, name) {
  const schema = schemas[name];
  if (!schema) throw new Error(`unknown state file: ${name}`);
  const file = fileOf(stateDir, name);
  if (!fs.existsSync(file)) return schema.parse(DEFAULTS[name]);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`invalid JSON in ${name}: ${err.message}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(`validation failed reading ${name}: ${parsed.error.message}`);
  return parsed.data;
}

export function writeStateFile(stateDir, name, data) {
  const schema = schemas[name];
  if (!schema) throw new Error(`unknown state file: ${name}`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`validation failed writing ${name}: ${parsed.error.message}`);
  fs.mkdirSync(stateDir, { recursive: true });
  const file = fileOf(stateDir, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(parsed.data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return parsed.data;
}
