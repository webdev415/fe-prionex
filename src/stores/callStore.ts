/**
 * Call Store
 *
 * Global store for managing minimized call modals with localStorage persistence.
 */

import { create } from 'zustand'

export type CallModalType = 'call-dialog' | 'call-recording'

export interface MinimizedCallInfo {
  id: string
  type: CallModalType
  clientName: string
  phoneNumber: string
  // For call dialog
  callState?: 'initial' | 'dialing' | 'connected' | 'ended' | 'incoming'
  callType?: 'white-line' | 'gray-line' | 'spam-calls'
  elapsedTime?: number
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
    // Check if there's a minimized call that's active (dialing or connected)
    if (state.minimizedCall) {
      if (
        state.minimizedCall.type === 'call-dialog' &&
        (state.minimizedCall.callState === 'dialing' ||
          state.minimizedCall.callState === 'connected')
      ) {
        return true
      }
      // For call recordings, if it's minimized, consider it active
      if (state.minimizedCall.type === 'call-recording') {
        return true
      }
    }
    // Check if there's an open modal
    if (state.openCallModal) {
      return true
    }
    return false
  },
}))
