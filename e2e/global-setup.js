import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = '4778';
const READY_URL = `http://localhost:${PORT}/api/dashboard`;
const READY_TIMEOUT_MS = 15000;
const READY_POLL_MS = 200;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the dashboard endpoint until it responds OK or the timeout elapses.
 * Fails fast if the child process exits before the server becomes ready,
 * instead of polling uselessly until the timeout.
 * @param {string} url
 * @param {number} timeoutMs
 * @param {import('node:child_process').ChildProcess} child
 */
async function waitForServer(url, timeoutMs, child) {
  let exitInfo = null;
  const onExit = (code, signal) => {
    exitInfo = { code, signal };
  };
  child.once('exit', onExit);

  try {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      if (exitInfo) {
        throw new Error(
          `server process exited before becoming ready (code=${exitInfo.code}, signal=${exitInfo.signal})`
        );
      }
      try {
        const res = await fetch(url);
        if (res.ok) return;
        lastError = new Error(`server responded with status ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      await sleep(READY_POLL_MS);
    }
    if (exitInfo) {
      throw new Error(
        `server process exited before becoming ready (code=${exitInfo.code}, signal=${exitInfo.signal})`
      );
    }
    throw new Error(`server did not become ready within ${timeoutMs}ms: ${lastError?.message ?? 'unknown error'}`);
  } finally {
    child.off('exit', onExit);
  }
}

/** Kill the child process (and, on Windows, its process tree as a belt-and-braces fallback). */
function killServer(server) {
  server.kill();
  if (process.platform === 'win32' && server.pid) {
    try {
      execFileSync('taskkill', ['/PID', String(server.pid), '/F', '/T'], { stdio: 'ignore' });
    } catch {
      // Process may have already exited; nothing more to do.
    }
  }
}

/**
 * Remove the temp fixture/vault directory. Windows can briefly hold file
 * locks after the server process exits, so retry once after a short delay
 * before giving up — a leftover temp dir isn't worth failing the whole run.
 * @param {string} root
 */
async function removeRoot(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
    return;
  } catch {
    // fall through to retry
  }
  await sleep(500);
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[e2e] warning: failed to remove temp dir ${root}: ${err?.message ?? err}`);
  }
}

export default async function globalSetup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-e2e-'));
  const fx = path.resolve('server/test/fixtures');
  const put = (rel, f) => {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(fx, f), dest);
  };
  put('second-brain/wiki/syntheses/learning-report-card.md', 'learning-report-card.md');
  put('second-brain/tutor/gradebook.md', 'gradebook.md');
  put('second-brain/tutor/concept-mastery.md', 'concept-mastery.md');
  put('second-brain/wiki/log.md', 'log.md');
  put('japanesetutor/progress.md', 'progress.md');

  const server = spawn('node', ['server/index.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      WAHNAHBE_VAULT: path.join(root, 'second-brain'),
      WAHNAHBE_JP_VAULT: path.join(root, 'japanesetutor'),
      WAHNAHBE_PORT: PORT,
      WAHNAHBE_LOG_DIR: path.join(root, 'logs'),
    },
    stdio: 'inherit',
    shell: false,
  });

  try {
    await waitForServer(READY_URL, READY_TIMEOUT_MS, server);
  } catch (err) {
    killServer(server);
    await removeRoot(root);
    throw err;
  }

  process.env.E2E_ROOT = root;
  return async () => {
    killServer(server);
    await removeRoot(root);
  };
}
