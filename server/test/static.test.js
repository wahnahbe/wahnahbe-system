import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

describe('static serving', () => {
  it('serves index.html for non-api routes when dist exists', async () => {
    const env = makeFixtureEnv();
    const dist = path.join(env.root, 'dist');
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>WAHNAHBE SYSTEM</title>');
    const app = createApp({ ...env.config, webDist: dist });
    expect((await request(app).get('/')).text).toContain('WAHNAHBE');
    expect((await request(app).get('/api/dashboard')).body.ok).toBe(true);
  });
});
