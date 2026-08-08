/**
 * Call Store
 *
 * Global store for managing minimized call modals with localStorage persistence.
 */

import { create } from 'zustand'

import type { IncomingCallClient } from '@/features/calls/types'

export type CallModalType = 'call-dialog' | 'call-recording'

/** Loan card shape the call modal renders; mirrored here so it survives minimize. */
export interface IncomingModalLoan {
  id: string
  clientName: string
  loanNumber: string
  counterparty: string
  loanPrincipal: number
  debt: number
  status: string
  saleDate: string
  lastContact: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
}

export interface MinimizedCallInfo {
  id: string
  type: CallModalType
  clientId?: number | null
  clientName: string
  phoneNumber: string // ORIGINAL client phone — used as the restored modal's phoneNumber prop
  displayPhone?: string // What the bubble tooltip should show (manual/dialed number if any)
  // For call dialog
  callId?: string | null // SIP call ID for hangup/state tracking
  callState?: 'initial' | 'dialing' | 'connected' | 'ended' | 'failed' | 'incoming'
  callType?: 'white-line' | 'gray-line' | 'spam-calls'
  elapsedTime?: number
  manualPhoneEnabled?: boolean
  manualPhoneDigits?: string
  // Screen-pop payload, carried so restoring a minimized inbound call brings
  // back the caller card rather than an empty modal.
  loans?: IncomingModalLoan[]
  incomingContext?: IncomingCallClient | null
  incomingClients?: IncomingCallClient[]
  // For call recording
  callData?: {
    type: string
    clientName: string
    date: string
    time: string
    operator: string
    duration: string
    phone: string
  }
  timestamp: number
}

interface CallStore {
  minimizedCall: MinimizedCallInfo | null
  openCallModal: 'call-dialog' | 'call-recording' | null
  setMinimizedCall: (call: MinimizedCallInfo | null) => void
  setOpenCallModal: (type: 'call-dialog' | 'call-recording' | null) => void
  restoreCall: () => void
  clearMinimizedCall: () => void
  isCallActive: () => boolean
  isCallWindowLive: () => boolean
}

const STORAGE_KEY = 'minimized-call-storage'

/**
 * A restored window may only survive long enough to cover a page reload during
 * a call. It used to be 24 h, which let a leftover bubble suppress every
 * inbound screen-pop for the rest of the day — the operator sees no popup and
 * no reason for its absence.
 */
const MAX_RESTORE_AGE_MS = 30 * 60 * 1000

const TERMINAL_CALL_STATES = new Set<MinimizedCallInfo['callState']>(['ended', 'failed'])

/**
 * Whether a stored window could still be updated by anything.
 *
 * `MinimizedCallBubble` only polls call details while the state is
 * dialing/connected/incoming *and* a `callId` is known, and only clears itself
 * once polling reports a terminal state. An entry outside that set — most
 * reachably `initial`, from a call dialog minimised before dialling — therefore
 * never polls, never turns terminal, and never auto-dismisses. Restoring one
 * resurrects a window nothing will ever take away.
 */
function canStillSettle(call: MinimizedCallInfo): boolean {
  if (call.type !== 'call-dialog') return true
  if (!call.callId) return false
  return (
    call.callState === 'dialing' || call.callState === 'connected' || call.callState === 'incoming'
  )
}

// Helper functions for localStorage
const getStoredCallState = (): MinimizedCallInfo | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as MinimizedCallInfo
    if (
      typeof parsed.clientName !== 'string' ||
      typeof parsed.phoneNumber !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (Date.now() - parsed.timestamp > MAX_RESTORE_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // A window that has already ended, or that nothing will ever update, must
    // not come back: it cannot be cleared by the bubble's own polling, and
    // while it sits in the store it suppresses the incoming-call popup.
    if (TERMINAL_CALL_STATES.has(parsed.callState) || !canStillSettle(parsed)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const setStoredCallState = (call: MinimizedCallInfo | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (call) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(call))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

export const useCallStore = create<CallStore>((set, get) => ({
  minimizedCall: getStoredCallState(),
  openCallModal: null,
  setMinimizedCall: (call) => {
    setStoredCallState(call)
    set({ minimizedCall: call })
  },
  setOpenCallModal: (type) => {
    set({ openCallModal: type })
  },
  restoreCall: () => {
    // This will be handled by the components
    set((state) => ({ minimizedCall: state.minimizedCall }))
  },
  clearMinimizedCall: () => {
    setStoredCallState(null)
    set({ minimizedCall: null })
  },
  isCallActive: () => {
    const state = get()
    // Check if there's a minimized call - any minimized call is considered active
    if (state.minimizedCall) {
      return true
    }
    // Check if there's an open modal
    if (state.openCallModal) {
      return true
    }
    return false
  },
  isCallWindowLive: () => {
    const state = get()
    // An open modal is on screen in this session — it is not persisted, so it
    // cannot be a leftover from an earlier one.
    if (state.openCallModal) return true
    const minimized = state.minimizedCall
    if (!minimized) return false
    // A bubble showing an ended call is not a call in progress. It clears
    // itself three seconds later, and until then it must not stand in for one.
    return !TERMINAL_CALL_STATES.has(minimized.callState)
  },
}))
