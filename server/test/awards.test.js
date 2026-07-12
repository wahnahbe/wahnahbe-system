import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { awardXp } from '../awards.js';
import { makeFixtureEnv } from './helpers/fixtureEnv.js';

let env;
beforeEach(() => { env = makeFixtureEnv(); });

it('awards XP using 0 report-card XP and warns when the report card is unreadable', () => {
  // Gut the fixture report card so parsing fails.
  fs.writeFileSync(env.config.sources.reportCard, 'not a valid report card at all');
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const award = awardXp(env.config, { amount: 15, stat: 'GENERAL', reason: 'test', source: 'test' });
    expect(award.amount).toBe(15);
    expect(award.total).toBe(15);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toMatch(/award: report card unreadable, using 0/);
  } finally {
    errSpy.mockRestore();
  }
});
