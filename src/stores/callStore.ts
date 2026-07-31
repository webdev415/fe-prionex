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
}

const STORAGE_KEY = 'minimized-call-storage'

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
    // Check if stored data is too old (e.g., more than 24 hours)
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    if (Date.now() - parsed.timestamp > maxAge) {
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
}))
