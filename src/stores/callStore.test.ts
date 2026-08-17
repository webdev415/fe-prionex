import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { MinimizedCallInfo } from './callStore'

const STORAGE_KEY = 'minimized-call-storage'

function stored(overrides: Partial<MinimizedCallInfo> = {}): MinimizedCallInfo {
  return {
    id: 'call-dialog-1',
    type: 'call-dialog',
    clientName: 'Кондратюк Наталія',
    phoneNumber: '380675378021',
    callId: '72462e71-4419-48d9-8f65-5a534500e856',
    callState: 'dialing',
    timestamp: Date.now(),
    ...overrides,
  }
}

/**
 * The store reads localStorage once, when the module is first evaluated, so a
 * fresh import per case is the only way to exercise the restore path.
 */
async function loadStore(entry: MinimizedCallInfo | null) {
  if (entry) localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
  else localStorage.removeItem(STORAGE_KEY)
  vi.resetModules()
  const { useCallStore } = await import('./callStore')
  return useCallStore
}

describe('callStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('what may be restored from a previous session', () => {
    it('restores a call that is still in progress', async () => {
      const store = await loadStore(stored({ callState: 'connected' }))

      // The whole point of persisting: a reload mid-call keeps the bubble.
      expect(store.getState().minimizedCall).not.toBeNull()
    })

    it.each(['ended', 'failed'] as const)('does not restore a %s call', async (callState) => {
      const store = await loadStore(stored({ callState }))

      expect(store.getState().minimizedCall).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('does not restore a dialog minimised before dialling', async () => {
      // `initial` never polls, so it never turns terminal and the bubble's
      // auto-dismiss never fires — it would sit there for the full retention
      // window suppressing every incoming-call popup.
      const store = await loadStore(stored({ callState: 'initial' }))

      expect(store.getState().minimizedCall).toBeNull()
    })

    it('does not restore a call whose id was never assigned', async () => {
      // Same trap by a different route: polling is keyed on callId, so a
      // window minimised before origination returned can never settle.
      const store = await loadStore(stored({ callId: null }))

      expect(store.getState().minimizedCall).toBeNull()
    })

    it('does not restore a call older than the retention window', async () => {
      const store = await loadStore(stored({ timestamp: Date.now() - 31 * 60 * 1000 }))

      expect(store.getState().minimizedCall).toBeNull()
    })

    it('still restores a call from a few minutes ago', async () => {
      const store = await loadStore(stored({ timestamp: Date.now() - 5 * 60 * 1000 }))

      expect(store.getState().minimizedCall).not.toBeNull()
    })
  })

  describe('settleWindowForCall', () => {
    const CALL = '72462e71-4419-48d9-8f65-5a534500e856'

    it('settles the window belonging to the call that ended', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callId: CALL, callState: 'connected' }))

      store.getState().settleWindowForCall(CALL, { state: 'ended', totalDuration: 137 })

      // Settled, not deleted. Deleting it skips the whole end-of-call sequence
      // the bubble owns — "Call ended", the final duration, the three-second
      // grace before it disappears — on every call the socket reports before
      // the two-second poll does, which is nearly all of them.
      const settled = store.getState().minimizedCall
      expect(settled?.callState).toBe('ended')
      expect(settled?.elapsedTime).toBe(137)
    })

    it('records a failed call as failed rather than ended', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callId: CALL, callState: 'dialing' }))

      store.getState().settleWindowForCall(CALL, { state: 'failed' })

      expect(store.getState().minimizedCall?.callState).toBe('failed')
    })

    it('keeps the running duration when the event carries none', async () => {
      const store = await loadStore(null)
      store
        .getState()
        .setMinimizedCall(stored({ callId: CALL, callState: 'connected', elapsedTime: 42 }))

      store.getState().settleWindowForCall(CALL, { state: 'ended' })

      expect(store.getState().minimizedCall?.elapsedTime).toBe(42)
    })

    it('stops standing in for a call in progress once settled', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callId: CALL, callState: 'connected' }))

      store.getState().settleWindowForCall(CALL, { state: 'ended' })

      // The reason this exists at all: a window that outlives its call
      // suppresses every inbound screen-pop until something clears it.
      expect(store.getState().isCallWindowLive()).toBe(false)
    })

    it('leaves an already-settled window untouched', async () => {
      const store = await loadStore(null)
      store
        .getState()
        .setMinimizedCall(stored({ callId: CALL, callState: 'ended', elapsedTime: 137 }))
      const before = store.getState().minimizedCall

      store.getState().settleWindowForCall(CALL, { state: 'ended' })

      // A repeat event must not rewrite the entry: the bubble's auto-dismiss is
      // keyed on it, so a new object identity restarts the three-second timer
      // and the bar can be held on screen indefinitely.
      expect(store.getState().minimizedCall).toBe(before)
    })

    it('leaves a window for a different call alone', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callId: CALL, callState: 'connected' }))

      // Two calls can be in flight for one operator. Settling on any terminal
      // event would end the window of a call still in progress.
      store
        .getState()
        .settleWindowForCall('ab2b3fce-bd6a-40a5-85a8-6d22b03b630b', { state: 'ended' })

      expect(store.getState().minimizedCall?.callState).toBe('connected')
    })

    it('leaves a window whose call was never identified alone', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callId: null, callState: 'dialing' }))

      store.getState().settleWindowForCall(CALL, { state: 'ended' })

      expect(store.getState().minimizedCall?.callState).toBe('dialing')
    })

    it('does nothing when no window is open', async () => {
      const store = await loadStore(null)

      expect(() => store.getState().settleWindowForCall(CALL, { state: 'ended' })).not.toThrow()
      expect(store.getState().minimizedCall).toBeNull()
    })
  })

  describe('isCallWindowLive', () => {
    it('is false with nothing open', async () => {
      const store = await loadStore(null)

      expect(store.getState().isCallWindowLive()).toBe(false)
    })

    it('is true while a modal is open', async () => {
      const store = await loadStore(null)
      store.getState().setOpenCallModal('call-dialog')

      expect(store.getState().isCallWindowLive()).toBe(true)
    })

    it('is true for a call in progress', async () => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callState: 'connected' }))

      expect(store.getState().isCallWindowLive()).toBe(true)
    })

    it.each(['ended', 'failed'] as const)('is false for a %s call', async (callState) => {
      const store = await loadStore(null)
      store.getState().setMinimizedCall(stored({ callState }))

      // The bubble clears itself three seconds after a call settles. Until it
      // does, an ended call must not pass for one in progress — that is what
      // silently swallowed the inbound screen-pop on 2026-08-08.
      expect(store.getState().isCallWindowLive()).toBe(false)
    })
  })
})
