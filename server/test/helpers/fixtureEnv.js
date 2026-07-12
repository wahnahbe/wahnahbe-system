import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../config.js';

export function makeFixtureEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wahnahbe-env-'));
  const vaultDir = path.join(root, 'second-brain');
  const jpVaultDir = path.join(root, 'japanesetutor');
  const fx = path.join(import.meta.dirname, '..', 'fixtures');
  const put = (rel, fixture) => {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(fx, fixture), dest);
  };
  put('second-brain/wiki/syntheses/learning-report-card.md', 'learning-report-card.md');
  put('second-brain/tutor/gradebook.md', 'gradebook.md');
  put('second-brain/tutor/concept-mastery.md', 'concept-mastery.md');
  put('second-brain/wiki/log.md', 'log.md');
  put('japanesetutor/progress.md', 'progress.md');
  const config = loadConfig({ WAHNAHBE_VAULT: vaultDir, WAHNAHBE_JP_VAULT: jpVaultDir });
  return { root, vaultDir, jpVaultDir, stateDir: config.stateDir, config };
}
