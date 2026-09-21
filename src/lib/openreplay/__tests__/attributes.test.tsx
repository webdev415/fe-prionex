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

describe('the whole of src/', { timeout: 60_000 }, () => {
  it('leaves no <iframe> capturing', async () => {
    const sources = await readAll()
    const withIframe = sources.filter(([, text]) => text.includes('<iframe'))
    // Guards the sweep itself: a glob that silently matched nothing would make
    // the assertion below vacuously true.
    expect(withIframe.length).toBeGreaterThanOrEqual(5)

    const offenders = sources.flatMap(([path, text]) => {
      const { iframes } = auditSource(path.replace(/^\//, ''), text) as { iframes: Finding[] }
      return iframes.map((f) => `${f.path}:${f.line}`)
    })
    expect(
      offenders,
      'Put the attribute on the <iframe> ITSELF. A same-origin document — every ' +
        'blob: URL included, since it inherits our origin — is otherwise written ' +
        'into the recording in full.'
    ).toEqual([])
  })

  it('leaves no personal data in an attribute the tracker sends verbatim', async () => {
    const sources = await readAll()
    const offenders = sources.flatMap(([path, text]) => {
      const { attributes } = auditSource(path.replace(/^\//, ''), text) as {
        attributes: Finding[]
      }
      return attributes.map((f) => `${f.path}:${f.line} ${f.attribute} on ${f.host}`)
    })
    expect(
      offenders,
      'Attributes are NOT masked outside privateMode. Use <PiiTooltip> for a ' +
        'hover-reveal, or a role label for an icon or an avatar.'
    ).toEqual([])
  })
})
