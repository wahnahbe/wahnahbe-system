import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { createApp } from '../app.js';
import { createBus, startWatcher } from '../watch.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

function openSse(port) {
  return new Promise((resolve) => {
    const chunks = [];
    const req = http.get({ port, path: '/api/events' }, (res) => {
      res.on('data', (c) => chunks.push(c.toString()));
      resolve({ res, chunks, close: () => req.destroy() });
    });
  });
}

describe('SSE /api/events', () => {
  it('pushes refresh events from the bus', async () => {
    const env = makeFixtureEnv();
    const bus = createBus();
    const server = createApp(env.config, bus).listen(0);
    const port = server.address().port;
    const sse = await openSse(port);
    bus.emit('refresh');
    await new Promise((r) => setTimeout(r, 100));
    expect(sse.chunks.join('')).toContain('event: refresh');
    sse.close();
    server.close();
  });
});

describe('bus', () => {
  it('unsubscribes cleanly', () => {
    const bus = createBus();
    let n = 0;
    const un = bus.subscribe(() => { n += 1; });
    bus.emit('refresh');
    un();
    bus.emit('refresh');
    expect(n).toBe(1);
  });
});

describe('watcher', () => {
  it('watcher error invokes onError instead of throwing', async () => {
    const env = makeFixtureEnv();
    const bus = createBus();
    const errors = [];
    const watcher = startWatcher(env.config, bus, (e) => errors.push(e));
    watcher.emit('error', new Error('boom'));
    expect(errors).toHaveLength(1);
    await watcher.close();
  });

  it('close cancels a pending debounce refresh', async () => {
    const env = makeFixtureEnv();
    const bus = createBus();
    let fired = 0;
    bus.subscribe(() => { fired += 1; });
    const watcher = startWatcher(env.config, bus, () => {});
    watcher.emit('all', 'change', 'x');
    await watcher.close();
    await new Promise((r) => setTimeout(r, 400));
    expect(fired).toBe(0);
  });
});
