/**
 * KAN-KB-54 — the markup of the chrome that is on screen on EVERY route,
 * phase 3.5.
 *
 * These are the components the task statement singles out as the ones a
 * five-field grep loses (`NotificationBell` renders `trainer_full_name`), and
 * they are also the worst place for a miss: a leak in a page component costs
 * the recordings of that page, a leak in the header costs every recording there
 * is.
 *
 * The notification bell is Radix, so its content is a PORTAL — rendered under
 * `document.body`, where inheritance from anything in the header cannot reach.
 * That is the case these tests exist for.
 */

import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Pii, piiProps, OPENREPLAY_OBSCURED_ATTR } from '@/lib/openreplay/pii'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'
import { createPortal } from 'react-dom'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

describe('layout chrome PII markup — inheritance and portals', () => {
  it('does not reach a portal from a marked ancestor', () => {
    // 🔴 The reason every portal is marked from the INSIDE. If this ever starts
    // passing, the tracker has changed how it walks the DOM and the markup in
    // NotificationBell, TaskBell, UserProfile and DashboardLayout can be
    // simplified — until then, an attribute on the trigger buys nothing.
    render(<div {...piiProps}>{createPortal(<span>Коваленко Олег</span>, document.body)}</div>)
    expectNotObscured(screen.getByText('Коваленко Олег'))
  })

  it('covers a name inside portal content that carries the attribute itself', () => {
    render(<div>{createPortal(<Pii as="div">Коваленко Олег</Pii>, document.body)}</div>)
    expectObscured(screen.getByText('Коваленко Олег'))
  })
})

describe('layout chrome PII markup — the header components carry the attribute', () => {
  // A source-level assertion, deliberately: rendering the real header needs the
  // auth store, the router, react-query and four notification feeds, and a test
  // that mocks all of those proves that the mocks are wired, not that the markup
  // is. What has to be true is that each of these files emits the attribute at
  // all — the audit proves WHICH nodes, this proves the import did not get
  // dropped by a merge.
  const FILES = [
    'DashboardLayout',
    'MinimizedCallBubble',
    'MinimizedChainExecutorBubble',
    'NotificationBell',
    'TaskBell',
    'UserProfile',
  ]

  it.each(FILES)('%s imports the shared constant rather than the literal', async (name) => {
    const source = await import(`../${name}.tsx?raw`)
    const text = source.default as string
    // The literal must appear nowhere: a typo in it is a silent leak, which is
    // the whole reason the constant exists.
    const literalUses = text.split(OPENREPLAY_OBSCURED_ATTR).length - 1
    const importsShared = text.includes("from '@/lib/openreplay/pii'")
    if (literalUses > 0) {
      throw new Error(`${name} spells the attribute out; import piiProps instead`)
    }
    if (!importsShared) {
      throw new Error(`${name} lost its import of the PII markup helpers`)
    }
  })
})
