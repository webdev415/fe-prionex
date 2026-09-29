#!/usr/bin/env node
/**
 * Planner API types (planner story 1.9, AA-72).
 *
 * Generates `src/api/planner/schema.ts` — types only, no runtime — from the
 * vendored `src/api/planner/openapi.yaml` with openapi-typescript 7.13.x, then
 * formats it with the repo's Prettier config so `format:check` stays green.
 *
 *   node scripts/gen-planner-types.mjs          # write schema.ts
 *   node scripts/gen-planner-types.mjs --check  # exit 1 when schema.ts drifted
 *
 * `--check` is what the unit test `src/api/planner/__tests__/schemaDrift.test.ts`
 * runs, so the CI `test` job fails on drift without a workflow change.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'
import * as prettier from 'prettier'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const yamlPath = resolve(root, 'src/api/planner/openapi.yaml')
const outPath = resolve(root, 'src/api/planner/schema.ts')

export async function renderPlannerSchema() {
  const source = readFileSync(yamlPath, 'utf8')
  const pin = source.match(/^# planner-commit: ([0-9a-f]{40})$/m)
  if (!pin) {
    throw new Error('src/api/planner/openapi.yaml: missing "# planner-commit: <40-hex sha>" line')
  }
  const ast = await openapiTS(source)
  const banner =
    `// Planner API types — generated from src/api/planner/openapi.yaml\n` +
    `// (CRM/planner @ ${pin[1]}) by scripts/gen-planner-types.mjs.\n` +
    `// Do not edit: run \`npm run planner:types\`.\n`
  const raw = banner + COMMENT_HEADER + astToString(ast)
  const config = (await prettier.resolveConfig(outPath)) ?? {}
  return prettier.format(raw, { ...config, filepath: outPath })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const expected = await renderPlannerSchema()
  if (process.argv.includes('--check')) {
    let actual = ''
    try {
      actual = readFileSync(outPath, 'utf8')
    } catch {
      actual = ''
    }
    if (actual !== expected) {
      console.error(
        'src/api/planner/schema.ts is out of date with openapi.yaml — run `npm run planner:types`'
      )
      process.exit(1)
    }
    console.log('planner schema.ts is up to date')
  } else {
    writeFileSync(outPath, expected)
    console.log('wrote src/api/planner/schema.ts')
  }
}
