import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  it('uses defaults when no env overrides', () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(4777);
    expect(cfg.vaultDir).toBe('C:\\Users\\gjgut\\second-brain');
    expect(cfg.jpVaultDir).toBe('C:\\Users\\gjgut\\japanesetutor');
    expect(cfg.stateDir).toBe('C:\\Users\\gjgut\\second-brain\\system');
    expect(cfg.sources.reportCard).toContain('learning-report-card.md');
  });

  it('honors env overrides and derives stateDir from vaultDir', () => {
    const cfg = loadConfig({ WAHNAHBE_VAULT: 'D:\\vault', WAHNAHBE_PORT: '5000' });
    expect(cfg.port).toBe(5000);
    expect(cfg.stateDir).toBe('D:\\vault\\system');
    expect(cfg.sources.wikiLog).toBe('D:\\vault\\wiki\\log.md');
  });

  it('asserts exact paths for gradebook, conceptMastery, and jpProgress sources', () => {
    const cfg = loadConfig({});
    expect(cfg.sources.gradebook).toBe('C:\\Users\\gjgut\\second-brain\\tutor\\gradebook.md');
    expect(cfg.sources.conceptMastery).toBe('C:\\Users\\gjgut\\second-brain\\tutor\\concept-mastery.md');
    expect(cfg.sources.jpProgress).toBe('C:\\Users\\gjgut\\japanesetutor\\progress.md');
  });

  it('falls back to default port when WAHNAHBE_PORT is invalid', () => {
    const cfgAbc = loadConfig({ WAHNAHBE_PORT: 'abc' });
    expect(cfgAbc.port).toBe(4777);
    const cfgEmpty = loadConfig({ WAHNAHBE_PORT: '' });
    expect(cfgEmpty.port).toBe(4777);
  });
});
