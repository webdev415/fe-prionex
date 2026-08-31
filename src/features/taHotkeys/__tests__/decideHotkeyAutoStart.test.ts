/**
 * KAN-973 — when a hotkey's template may be auto-started.
 *
 * The case worth the file is the loading race. The instances query reports
 * "still loading" and "none active" identically, so a naive check starts a
 * second chain for a client who already has one — a 409, and a confusing one
 * because it only happens when the network is slow. Two bugs of exactly this
 * shape were found in this component during the KAN-977 review.
 */
import { describe, expect, it } from 'vitest'
import { decideHotkeyAutoStart } from '../decideHotkeyAutoStart'

const TEMPLATES = [
  { id: 1, chain_id: 10 },
  { id: 2, chain_id: 20 },
]

const decide = (over: Partial<Parameters<typeof decideHotkeyAutoStart>[0]> = {}) =>
  decideHotkeyAutoStart({
    initialTemplateId: 1,
    instancesLoaded: true,
    hasActiveInstance: false,
    templates: TEMPLATES,
    ...over,
  })

describe('decideHotkeyAutoStart', () => {
  it('starts the template once everything has loaded', () => {
    expect(decide().start).toEqual({ id: 1, chain_id: 10 })
  })

  it('picks the template by id, not by position', () => {
    expect(decide({ initialTemplateId: 2 }).start).toEqual({ id: 2, chain_id: 20 })
  })

  // ── the loading race ──────────────────────────────────────────────────────
  it('waits while the instances query is still loading', () => {
    // "No active instance" is indistinguishable from "not loaded yet" at the
    // call site; starting here would 409 for a client mid-chain.
    expect(decide({ instancesLoaded: false }).start).toBeNull()
  })

  it('still waits while loading even though everything else is ready', () => {
    expect(decide({ instancesLoaded: false, hasActiveInstance: false }).start).toBeNull()
  })

  // ── deferring to a running chain ──────────────────────────────────────────
  it('does not start when the client already has an active instance', () => {
    expect(decide({ hasActiveInstance: true }).start).toBeNull()
  })

  // ── nothing to do ─────────────────────────────────────────────────────────
  it('does nothing when the modal was opened by a click', () => {
    expect(decide({ initialTemplateId: null }).start).toBeNull()
  })

  it('does nothing, silently, when the template is not accessible', () => {
    // Per the ticket a mapping to a template the operator can no longer run
    // behaves as unassigned — no error, no modal state change.
    expect(decide({ initialTemplateId: 99 }).start).toBeNull()
  })

  it('does nothing while the template list is still empty', () => {
    // Same return as "inaccessible" on purpose: the caller does not latch on a
    // null result, so this retries when the list arrives.
    expect(decide({ templates: [] }).start).toBeNull()
  })

  it('never returns a template that is not in the list', () => {
    for (const id of [null, 1, 2, 99]) {
      const { start } = decide({ initialTemplateId: id })
      expect(start === null || TEMPLATES.includes(start as (typeof TEMPLATES)[number])).toBe(true)
    }
  })
})

describe('why the caller has to latch', () => {
  // This covers the RULE only. The rule is stateless by design, so on its own
  // it will happily say "start" the moment an active instance disappears —
  // which is exactly why ChainExecutor must remember its earlier settled
  // answer. That behaviour is asserted in ChainExecutor.autoStart.test.tsx;
  // this documents the half that makes the latch necessary.
  it('defers while an instance is active, and that answer is provisional', () => {
    const templates = [{ id: 12 }]
    // Modal opened by a hotkey on a client who already has a chain running.
    expect(
      decideHotkeyAutoStart({
        initialTemplateId: 12,
        instancesLoaded: true,
        hasActiveInstance: true,
        templates,
      }).start
    ).toBeNull()

    // Operator cancels that instance. The rule alone now says "start" — which
    // is why the caller must have latched the earlier settled decision rather
    // than waiting for a successful start. Without that latch the chain would
    // begin on its own, from an action nobody took.
    expect(
      decideHotkeyAutoStart({
        initialTemplateId: 12,
        instancesLoaded: true,
        hasActiveInstance: false,
        templates,
      }).start
    ).toEqual({ id: 12 })
  })
})
