/**
 * Chain Executor Store
 *
 * Global store for managing minimized chain executor modals with localStorage persistence.
 * Follows the same pattern as callStore.ts.
 */

import { create } from 'zustand'

export interface MinimizedChainExecutorInfo {
  clientId: number
  clientName: string
  chainName: string | null
  currentStepOrder: number
  totalSteps: number
  timestamp: number
  debts: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
  }>
  formState: {
    stepValue: string
    promiseDate: string
    promiseAmount: string
    creditId: string
    notes: string
    completedSteps: Array<{ stepOrder: number; taName: string; taValue: string }>
    collectedStepData: Record<string, string>
    collectedDropdownValueIds: Record<string, number>
    collectedPromiseDate: string
    collectedPromiseAmount: string
    collectedCreditId: string
  }
}

interface ChainExecutorStore {
  minimized: MinimizedChainExecutorInfo | null
  setMinimized: (info: MinimizedChainExecutorInfo | null) => void
  clear: () => void
}

const STORAGE_KEY = 'minimized-chain-executor'

const getStored = (): MinimizedChainExecutorInfo | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as MinimizedChainExecutorInfo
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - parsed.timestamp > maxAge) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const setStored = (info: MinimizedChainExecutorInfo | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (info) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

export const useChainExecutorStore = create<ChainExecutorStore>((set) => ({
  minimized: getStored(),
  setMinimized: (info) => {
    setStored(info)
    set({ minimized: info })
  },
  clear: () => {
    setStored(null)
    set({ minimized: null })
  },
}))
