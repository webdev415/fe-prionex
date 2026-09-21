/**
 * Test helpers for the OpenReplay PII markup (KAN-KB-54).
 *
 * ⚠️ NOT named `*.test.ts` / `*.spec.ts` on purpose: `vitest.config.ts` collects
 * every file under `src` whose name ends in `.test.*` or `.spec.*`, so either of
 * those names would be picked up as a suite and fail the run with "no test suite
 * found".
 */

import { expect } from 'vitest'
import { OPENREPLAY_OBSCURED_ATTR, OPENREPLAY_HIDDEN_ATTR } from '@/lib/openreplay/pii'

const OBSCURED_SELECTOR = `[${OPENREPLAY_OBSCURED_ATTR}]`

/**
 * The element the tracker would read the attribute from, for a node of any kind.
 *
 * A text node has no `closest`, and `getByText` hands back the element that
 * CONTAINS the text — the two cases have to be told apart or the helper throws
 * on half its inputs.
 */
function elementFor(node: Node): Element | null {
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element
  return node.parentElement
}

/**
 * Assert that OpenReplay would record `node`'s text as asterisks.
 *
 * Checks the node OR ANY ANCESTOR, because that is exactly how the tracker
 * decides: `Sanitizer.handleNode` puts a node in the obscured set when its
 * parent is already in it, so an attribute on the surrounding card covers
 * everything inside it. Asserting on the node itself would reject the container
 * markup this plan is built on.
 */
export function expectObscured(node: Node | null | undefined): void {
  expect(node, 'expectObscured received no node — the query above matched nothing').toBeTruthy()
  const element = elementFor(node!)
  expect(
    element,
    'expectObscured received a detached text node with no parent element'
  ).toBeTruthy()
  expect(
    element!.closest(OBSCURED_SELECTOR),
    `no ancestor carries ${OPENREPLAY_OBSCURED_ATTR}: ` +
      `${(element!.textContent ?? '').slice(0, 80)}`
  ).not.toBeNull()
}

/** The negative form, for the parts of the screen that must stay readable. */
export function expectNotObscured(node: Node | null | undefined): void {
  expect(node, 'expectNotObscured received no node').toBeTruthy()
  const element = elementFor(node!)
  expect(element).toBeTruthy()
  expect(
    element!.closest(OBSCURED_SELECTOR),
    `unexpectedly obscured — screen titles, column names, navigation and statuses ` +
      `must stay readable: ${(element!.textContent ?? '').slice(0, 80)}`
  ).toBeNull()
}

/**
 * Assert that an `<iframe>` is excluded from capture.
 *
 * 🔴 The attribute must be on the `<iframe>` ITSELF, not on a wrapper. The
 * tracker's `TopObserver` captures an iframe when
 * `captureIFrames && !hasOpenreplayAttribute(node, 'obscured')`, reading the
 * attribute off the node in its node-callback — inheritance plays no part, so
 * the general `expectObscured` above would pass on markup that still records the
 * document inside.
 */
export function expectIframeNotCaptured(node: Element | null | undefined): void {
  expect(node, 'expectIframeNotCaptured received no node').toBeTruthy()
  expect(node!.tagName).toBe('IFRAME')
  expect(
    node!.hasAttribute(OPENREPLAY_OBSCURED_ATTR),
    `the <iframe> itself must carry ${OPENREPLAY_OBSCURED_ATTR} — an attribute on ` +
      `a wrapper does not stop iframe capture`
  ).toBe(true)
}

/** Assert the node (or an ancestor) is dropped from the recording entirely. */
export function expectHidden(node: Node | null | undefined): void {
  expect(node, 'expectHidden received no node').toBeTruthy()
  const element = elementFor(node!)
  expect(element).toBeTruthy()
  expect(element!.closest(`[${OPENREPLAY_HIDDEN_ATTR}]`)).not.toBeNull()
}
