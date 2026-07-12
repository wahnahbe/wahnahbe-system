import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4777' } },
  test: { environment: 'jsdom', include: ['test/**/*.test.js*'] },
});
