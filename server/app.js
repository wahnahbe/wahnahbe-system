import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { dashboardRouter } from './routes/dashboard.js';
import { questsRouter } from './routes/quests.js';
import { stateRouter } from './routes/stateRoutes.js';
import { eventsRouter } from './routes/events.js';
import { createBus } from './watch.js';

export function createApp(config, bus = createBus()) {
  const app = express();
  app.use(express.json());
  app.use('/api', dashboardRouter(config));
  app.use('/api', questsRouter(config));
  app.use('/api', stateRouter(config));
  app.use('/api', eventsRouter(bus));

  // Static serving with SPA fallback for production
  const dist = config.webDist ?? path.join(import.meta.dirname, '..', 'web', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Central error envelope for sync/async route errors.
  app.use((err, _req, res, _next) => {
    res.status(err.status ?? 500).json({ ok: false, error: err.message });
  });
  return app;
}
