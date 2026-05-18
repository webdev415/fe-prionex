import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
    // Pool options to prevent worker crashes
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single worker to prevent memory issues
      },
    },
    // Per-test timeout. Bumped from 10s → 20s because heavier component
    // tests (e.g. ``TagsPage`` modal interactions driven by userEvent)
    // measure ~7s on an unloaded machine and intermittently breach 10s
    // when the suite is sharing CPU with another build. 20s preserves a
    // genuine-hang detector while eliminating the timing flake — same
    // change ran clean across all 499 tests after this bump.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
