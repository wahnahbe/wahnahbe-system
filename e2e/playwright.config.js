import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.js',
  timeout: 30000,
  retries: 0,
  use: { baseURL: 'http://localhost:4778' },
});
