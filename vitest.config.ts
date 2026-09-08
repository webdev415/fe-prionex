import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Pin the test-run locale so number/date formatting is reproducible on every
// machine. Components render values with the locale-less `Number#toLocaleString()`,
// which resolves to the *OS* locale (`LANG`/`LC_ALL`) at process start — comma
// grouping on an en-US CI runner (`156,228`), but a non-breaking space on a dev
// box set to `ru_RU`/`uk_UA` (`156 228`). That divergence makes locale-sensitive
// assertions pass in CI yet fail the identical pre-commit run locally, breaking
// the hook's "clean local run ⇒ green CI" contract. We force `C.UTF-8` here (in
// the parent process, before Vitest forks its `pool: 'forks'` workers, which
// inherit this env) so ICU resolves to en-US everywhere — matching CI exactly.
process.env.LC_ALL = 'C.UTF-8'

// Pin the test-run timezone for the same reason: `new Date(...)` and every
// local-date read (getFullYear/getMonth/getDate) resolve against the process
// zone, so a suite that is green on a UTC/Kyiv machine can fail west of
// Greenwich (a bare "YYYY-MM-DD" parses as UTC midnight = the previous local
// day). Defaulted, not forced: with TZ unset (the usual case — CI and dev
// boxes alike) every run agrees on UTC, while an EXPLICIT
// `TZ=America/New_York npx vitest run …` still works as the way to hunt for
// exactly this class of bug.
process.env.TZ ??= 'UTC'

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
    // Pool options to prevent worker crashes under full-suite load (Vitest 4).
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    // Per-test timeout. Bumped from 10s → 20s because heavier component
    // tests (e.g. ``TagsPage`` modal interactions driven by userEvent)
    // measure ~7s on an unloaded machine and intermittently breach 10s
    // when the suite is sharing CPU with another build. 20s preserves a
    // genuine-hang detector while eliminating the timing flake — same
    // change ran clean across all 499 tests after this bump.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
