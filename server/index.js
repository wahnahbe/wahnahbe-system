import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createApp } from './app.js';
import { createBus, startWatcher } from './watch.js';
import { readStateFile, writeStateFile, DEFAULTS } from './state/io.js';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.appendFileSync(path.join(config.logDir, 'server.log'), line);
}

// Bootstrap: materialize any missing state file with its defaults.
for (const name of Object.keys(DEFAULTS)) {
  if (!fs.existsSync(path.join(config.stateDir, `${name}.json`))) {
    writeStateFile(config.stateDir, name, readStateFile(config.stateDir, name));
    log(`seeded ${name}.json`);
  }
}

const bus = createBus();
const watcher = startWatcher(config, bus, (err) => log(`WATCHER ERROR ${err.message}`));
const app = createApp(config, bus);
app.listen(config.port, '127.0.0.1', () => log(`WAHNAHBE SYSTEM online — http://localhost:${config.port}`));
process.on('uncaughtException', (e) => { log(`FATAL ${e.stack}`); process.exit(1); });
