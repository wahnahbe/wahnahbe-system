import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('boots, renders real data, completes a daily, live-updates on vault edit', async ({ page }) => {
  await page.goto('/');

  // The fixture vault starts with no settings.json, so defaults seed on boot
  // (reducedMotion: false) and the boot sequence overlay renders, showing its
  // first line ('[SYS] WAHNAHBE KERNEL v2.0'). Clicking that line skips the
  // overlay. Wait for it explicitly rather than blindly clicking 'body' —
  // that raced the overlay's mount and could land on nothing (or on the
  // fully-rendered app underneath) on slower machines. If the overlay has
  // already auto-finished before the wait attaches, waitFor/click will throw
  // (element not found), which we swallow and just proceed to the app assert.
  const boot = page.getByText('[SYS] WAHNAHBE KERNEL v2.0');
  try {
    await boot.waitFor({ state: 'visible', timeout: 3000 });
    await boot.click();
  } catch {
    // Boot overlay already finished (or never rendered) — nothing to skip.
  }

  // Assert the header wordmark via an exact-text match. A loose getByText('WAHNAHBE')
  // also matches the boot overlay's kernel line above, making it ambiguous while the
  // overlay is still mounted; exact match only matches the header wordmark itself.
  await expect(page.getByText('WAHNAHBE', { exact: true })).toBeVisible();

  // Renders real fixture data: learning-report-card.md has Total XP 249,
  // which levelInfo() resolves to level 4, 9 XP into level, 160 to next —
  // shown verbatim in the header XP label. This is a unique, fixture-derived
  // string, so it's a robust (non-ambiguous) proof the vault data loaded.
  await expect(page.getByText('9 / 160 XP')).toBeVisible();

  // Complete a daily -> XP notification + completed-state badge on the card.
  await page.getByText('▸ EXECUTE').first().click();
  await expect(page.getByText('+15 XP BANKED')).toBeVisible();
  await expect(page.getByText('[COMPLETE] ✓ XP AWARDED').first()).toBeVisible();

  // Edit the JP vault file on disk -> LANG card live-updates via SSE.
  // The card renders "STREAK {n}D" (uppercase D suffix), so match loosely.
  const jp = path.join(process.env.E2E_ROOT, 'japanesetutor', 'progress.md');
  fs.writeFileSync(jp, fs.readFileSync(jp, 'utf8').replace('streak: 14', 'streak: 99'));
  await expect(page.getByText(/STREAK 99/)).toBeVisible({ timeout: 5000 });
});
