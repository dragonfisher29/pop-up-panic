import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { target: 'es2022', sourcemap: true },
  // `npm run dev:api` serves the leaderboard on 8788; the Vite dev server forwards /api to it.
  server: { proxy: { '/api': 'http://localhost:8788' } },
  test: { include: ['src/**/*.test.ts', 'worker/**/*.test.ts'] },
});
