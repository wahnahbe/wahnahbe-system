import path from 'node:path';

export function loadConfig(env = process.env) {
  const vaultDir = env.WAHNAHBE_VAULT ?? 'C:\\Users\\gjgut\\second-brain';
  const jpVaultDir = env.WAHNAHBE_JP_VAULT ?? 'C:\\Users\\gjgut\\japanesetutor';
  const stateDir = env.WAHNAHBE_STATE_DIR ?? path.join(vaultDir, 'system');
  const rawPort = Number(env.WAHNAHBE_PORT ?? 4777);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 4777;
  return {
    port,
    vaultDir,
    jpVaultDir,
    stateDir,
    logDir: env.WAHNAHBE_LOG_DIR ?? path.join(import.meta.dirname, '..', 'logs'),
    sources: {
      reportCard: path.join(vaultDir, 'wiki', 'syntheses', 'learning-report-card.md'),
      gradebook: path.join(vaultDir, 'tutor', 'gradebook.md'),
      conceptMastery: path.join(vaultDir, 'tutor', 'concept-mastery.md'),
      wikiLog: path.join(vaultDir, 'wiki', 'log.md'),
      jpProgress: path.join(jpVaultDir, 'progress.md'),
    },
  };
}

export const config = loadConfig();
