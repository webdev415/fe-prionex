/**
 * KAN-KB-54, phase 4 acceptance: no personal data in the attributes the tracker
 * sends verbatim, and no `<iframe>` left capturing.
 *
 * 🔴 Why attributes need their own acceptance test at all. Outside `privateMode`
 * the tracker does not mask them: `sendNodeAttribute` sends `title`,
 * `aria-label` and `alt` exactly as written, from an obscured node and from a
 * hidden one alike. So this is the one class of leak that markup cannot fix and
 * that a frame-by-frame review of a recording cannot see — the value is in the
 * DOM, not on the screen.
 *
 * The sweep runs `scripts/pii-audit.mjs` rather than a regex of its own. That
 * script parses TypeScript, so it ignores comments and string literals; a regex
 * here reported this file's own documentation and two `placeholder` strings
 * holding a `{{client_name}}` MERGE FIELD as leaks. From phase 7 the same script
 * runs in CI — this is the copy that fails before the push rather than after.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { piiProps, OPENREPLAY_OBSCURED_ATTR } from '../pii'
import { expectIframeNotCaptured } from '@/test/piiHelpers'

// @ts-expect-error — a plain .mjs script, deliberately outside the app's type graph.
import { auditSource } from '../../../../scripts/pii-audit.mjs'

interface Finding {
  path: string
  line: number
  identifier: string
  attribute?: string
  host?: string
}

const SOURCES = import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default' })

async function readAll(): Promise<[string, string][]> {
  const entries = Object.entries(SOURCES).filter(
    ([path]) => !path.includes('__tests__') && !/\.(test|spec)\.tsx$/.test(path)
  )
  return Promise.all(
    entries.map(async ([p, load]) => [p, (await load()) as string] as const)
  ) as Promise<[string, string][]>
}

/**
 * 🔴 The sweep runs ONCE for the whole file, and the two tests below read its
 * result. It used to run twice — each `it` called `readAll()` and then parsed
 * every source again — which made this the slowest file in the suite by a wide
 * margin and, on a loaded machine, slower than vitest's 20s default timeout.
 *
 * That is not hypothetical: it flaked `CI / Unit Tests` on 2026-09-21 (2 passes
 * in 7 runs) and finally reproduced locally as
 * `leaves no <iframe> capturing — Test timed out in 20000ms`, at 28982ms, while
 * the machine was busy. The failure looked nothing like its cause from the
 * outside — CI logs are unreadable on this instance, so it presented as an
 * unexplained red job on branches that touch no source at all.
 *
 * Two independent things were wrong and both are fixed, because either alone
 * would leave the trap armed:
 *   1. the work was done twice for no reason — memoised here;
 *   2. a whole-tree scan was left on the DEFAULT timeout, which is sized for an
 *      ordinary unit test.
 *
 * 🔴 (2) is the load-bearing half, and the measurement says so: after the
 * memoisation, ONE sweep of `src/` still takes ~24s on an unloaded laptop
 * (`vitest run` of this file alone: 33s wall, 24.6s in tests). So each of the
 * two tests was previously sitting at roughly the 20s limit on a good day —
 * a coin flip, not bad luck, and it explains a CI pass rate of 2 in 7. Raising
 * the timeout without the memoisation, or memoising without raising it, would
 * each have left a file that fails again the next time `src/` grows.
 *
 * Do not "optimise" this back to the default by trimming the glob: the sweep
 * has to see the whole of `src/` or it is not an acceptance test.
 */
const AUDIT_TIMEOUT_MS = 120_000

let auditPromise: Promise<{
  sources: [string, string][]
  iframes: string[]
  attributes: string[]
}> | null = null

function auditAll() {
  auditPromise ??= (async () => {
    const sources = await readAll()
    const iframes: string[] = []
    const attributes: string[] = []
    for (const [path, text] of sources) {
      const found = auditSource(path.replace(/^\//, ''), text) as {
        iframes: Finding[]
        attributes: Finding[]
      }
      for (const f of found.iframes) iframes.push(`${f.path}:${f.line}`)
      for (const f of found.attributes) {
        attributes.push(`${f.path}:${f.line} ${f.attribute} on ${f.host}`)
      }
    }
    return { sources, iframes, attributes }
  })()
  return auditPromise
}

describe('iframe capture — the rule', () => {
  it('is not satisfied by a marked wrapper', () => {
    // 🔴 The single fact about iframes worth remembering. `TopObserver` captures
    // a frame when `captureIFrames && !hasOpenreplayAttribute(node, 'obscured')`
    // and reads the attribute off the NODE in its own callback. Inheritance is
    // never consulted, so the ordinary `expectObscured` would pass on markup
    // that still records the whole document inside.
    render(
      <div {...piiProps}>
        <iframe title="wrapped" data-testid="wrapped" />
      </div>
    )
    const frame = screen.getByTestId('wrapped')
    expect(frame.closest(`[${OPENREPLAY_OBSCURED_ATTR}]`)).not.toBeNull()
    expect(() => expectIframeNotCaptured(frame)).toThrow()
  })

  it('is satisfied by the attribute on the iframe', () => {
    render(<iframe title="marked" data-testid="marked" {...piiProps} />)
    expectIframeNotCaptured(screen.getByTestId('marked'))
  })
})

describe('the whole of src/', () => {
  it(
    'leaves no <iframe> capturing',
    async () => {
      const { sources, iframes } = await auditAll()
      const withIframe = sources.filter(([, text]) => text.includes('<iframe'))
      // Guards the sweep itself: a glob that silently matched nothing would make
      // the assertion below vacuously true.
      expect(withIframe.length).toBeGreaterThanOrEqual(5)

      expect(
        iframes,
        'Put the attribute on the <iframe> ITSELF. A same-origin document — every ' +
          'blob: URL included, since it inherits our origin — is otherwise written ' +
          'into the recording in full.'
      ).toEqual([])
    },
    AUDIT_TIMEOUT_MS
  )

  it(
    'leaves no personal data in an attribute the tracker sends verbatim',
    async () => {
      const { attributes } = await auditAll()
      expect(
        attributes,
        'Attributes are NOT masked outside privateMode. Use <PiiTooltip> for a ' +
          'hover-reveal, or a role label for an icon or an avatar.'
      ).toEqual([])
    },
    AUDIT_TIMEOUT_MS
  )
})
