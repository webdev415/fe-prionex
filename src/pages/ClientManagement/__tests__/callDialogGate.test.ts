import { describe, it, expect } from 'vitest'
import { callDialogBlockedReason } from '../callDialogGate'

const CLOSED = { allowed: false, message: 'Outside calling hours' }
const OPEN = { allowed: true, message: null }

describe('callDialogBlockedReason', () => {
  it('blocks the dialog when the window is shut', () => {
    expect(callDialogBlockedReason(CLOSED, false)).toBe('Outside calling hours')
  })

  it('lets the dialog open when the window is open', () => {
    expect(callDialogBlockedReason(OPEN, false)).toBeNull()
  })

  it('lets the dialog open for spam marking even when the window is shut', () => {
    // Marking a number as spam is not placing a call. Gating it too made the
    // action unreachable from the client card for the whole closed window.
    expect(callDialogBlockedReason(CLOSED, true)).toBeNull()
  })

  it('does not block without a reason to show', () => {
    // A refused window with no message would otherwise stop the dialog
    // silently, which is the dead control this feature exists to avoid.
    expect(callDialogBlockedReason({ allowed: false, message: null }, false)).toBeNull()
  })
})
