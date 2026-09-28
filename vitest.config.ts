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
    // 🔴 The suite runs IN PARALLEL as of 2026-09-16. It used to be pinned to a
    // single serial fork ("to prevent worker crashes under full-suite load"),
    // which cost the same on every machine: one core out of ten on a laptop, one
    // out of 104 on the CI host. By then the suite had grown from 228 files to
    // 544 and the CI job took 34 minutes, of which about three quarters was not
    // test execution at all — it was 544 repetitions of the same preparation
    // (a fresh jsdom, the module graph re-imported, this file's setup re-run).
    //
    // Measured on this suite (544 files, 5820 tests), 10-core laptop, wall-clock:
    //   maxWorkers: 1  ->  384s   (the setting this replaces)
    //   maxWorkers: 4  ->  124s   (3.1x)
    //   maxWorkers: 8  ->  103s   (3.7x, and total CPU climbs steeply —
    //                              the workers are fighting over cores)
    //   maxWorkers: '50%' -> 102s  (3.8x — the setting below; 5 workers on this
    //                              laptop, and it beats 8, which is the point:
    //                              past about half the cores the forks contend)
    // Every run was 544/544 files and 5820/5820 tests green. The crash the old
    // comment guarded against did NOT reproduce.
    //
    // ⚠️ Which is not proof it cannot happen: a flaky crash under load does not
    // show up on every run, by definition. If it comes back, pin a NUMBER here
    // rather than returning to 1 — serial is a 3x tax paid on every commit and
    // every CI run to avoid a failure nobody has reproduced since.
    //
    // A percentage rather than a number because the same file runs on both a
    // 10-core laptop (-> 5 workers) and a 104-core CI host (-> 52). A literal
    // would either waste the host or thrash the laptop. Memory: each fork holds
    // its own jsdom and module graph, measured at ~0.3 GB RSS, so 52 of them is
    // ~16 GB against the ~80 GB free on s1 — and the runner's `capacity: 2` can
    // put two such jobs side by side, which still fits.
    pool: 'forks',
    maxWorkers: '50%',
    fileParallelism: true,
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
