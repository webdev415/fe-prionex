/**
 * KAN-973 — the single-modal guard for hotkey launches.
 *
 * Three properties the ticket is explicit about, each easy to get wrong:
 *
 *  1. An unassigned combination does nothing AND says nothing. With bare-key
 *     bindings allowed, most keys an operator presses are unassigned; a toast
 *     on each would be constant noise.
 *  2. A session minimized on ANOTHER client still blocks. The snapshot is a
 *     persisted global, so restoring it would collide with a second modal.
 *  3. Blocking is silent-free: when a bound key is refused the operator is
 *     told, otherwise nothing happens and they cannot tell the feature from a
 *     broken keyboard.
 */
import { describe, expect, it } from 'vitest'
import { decideHotkeyLaunch } from '../decideHotkeyLaunch'

const decide = (over: Partial<Parameters<typeof decideHotkeyLaunch<number>>[0]> = {}) =>
  decideHotkeyLaunch<number>({
    template: 42,
    isExecutorOpen: false,
    hasMinimizedSession: false,
    ...over,
  })

describe('decideHotkeyLaunch', () => {
  it('launches when nothing is in the way', () => {
    expect(decide()).toEqual({ launch: 42, blocked: null })
  })

  // ── the silent case ───────────────────────────────────────────────────────
  it('stays silent for an unassigned combination', () => {
    expect(decide({ template: null })).toEqual({ launch: null, blocked: null })
  })

  it('stays silent for an unassigned combination even while a modal is open', () => {
    // Ordering matters: explaining why a modal that was never going to open did
    // not open is worse than saying nothing.
    expect(decide({ template: null, isExecutorOpen: true })).toEqual({
      launch: null,
      blocked: null,
    })
    expect(decide({ template: null, hasMinimizedSession: true })).toEqual({
      launch: null,
      blocked: null,
    })
  })

  // ── the guard ─────────────────────────────────────────────────────────────
  it('refuses and explains when a modal is already open', () => {
    expect(decide({ isExecutorOpen: true })).toEqual({ launch: null, blocked: 'open' })
  })

  it('refuses and explains when a session is minimized', () => {
    // Including one belonging to a different client — the store is global.
    expect(decide({ hasMinimizedSession: true })).toEqual({
      launch: null,
      blocked: 'minimized',
    })
  })

  it('refuses when both are true, naming the state the operator can see', () => {
    expect(decide({ isExecutorOpen: true, hasMinimizedSession: true })).toEqual({
      launch: null,
      blocked: 'open',
    })
  })

  // ── never both ────────────────────────────────────────────────────────────
  it('never launches and blocks at once', () => {
    for (const isExecutorOpen of [true, false]) {
      for (const hasMinimizedSession of [true, false]) {
        for (const template of [42, null]) {
          const d = decideHotkeyLaunch({ template, isExecutorOpen, hasMinimizedSession })
          expect(d.launch !== null && d.blocked !== null).toBe(false)
        }
      }
    }
  })

  it('treats a falsy-but-valid template id as assigned', () => {
    // Template id 0 is not a real id today, but `!template` would silence it
    // if one ever existed — an explicit null check is what makes this safe.
    expect(
      decideHotkeyLaunch({ template: 0, isExecutorOpen: false, hasMinimizedSession: false })
    ).toEqual({ launch: 0, blocked: null })
  })
})
