/**
 * Planner contract types must match the vendored openapi.yaml (planner story
 * 1.9, AC5, AA-72): «CI fe-prionex regenerates schema.ts and fails on drift».
 *
 * The CI `test` job runs this file, so drift fails the merge without a
 * workflow change. The check itself lives in `scripts/gen-planner-types.mjs
 * --check` (openapi-typescript 7.13.x + the repo Prettier config) and runs in a
 * child Node process: Node built-ins cannot be imported statically from `src/`
 * (`tsc -b` has only `vite/client` types — TS2307), hence the variable
 * specifier below, which TypeScript does not resolve.
 */
import { describe, expect, it } from 'vitest'
import vendoredYaml from '../openapi.yaml?raw'
import generatedSchema from '../schema.ts?raw'

type ExecFileSync = (
  file: string,
  args: string[],
  options: { cwd: string; encoding: 'utf8'; stdio: 'pipe' }
) => string

const CHILD_PROCESS = 'node:child_process'
// Vitest runs from the repository root (vitest.config.ts), locally and in CI.
const nodeProcess = (globalThis as unknown as { process: { execPath: string; cwd(): string } })
  .process

describe('planner contract types (schema.ts)', () => {
  it('pin the planner commit in the vendored openapi.yaml and in schema.ts', () => {
    const pin = vendoredYaml.match(/^# planner-commit: ([0-9a-f]{40})$/m)
    expect(pin).not.toBeNull()
    expect(generatedSchema).toContain(`(CRM/planner @ ${pin?.[1]})`)
  })

  it('are regenerated from openapi.yaml without drift', async () => {
    const { execFileSync } = (await import(/* @vite-ignore */ CHILD_PROCESS)) as {
      execFileSync: ExecFileSync
    }
    const out = execFileSync(nodeProcess.execPath, ['scripts/gen-planner-types.mjs', '--check'], {
      cwd: nodeProcess.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    })
    expect(out).toContain('up to date')
  }, 60_000)
})
