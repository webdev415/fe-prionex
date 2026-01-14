/**
 * usePersistedURLState Hook
 *
 * Provides localStorage persistence for URL-based state management.
 * Filters and pagination persist even when navigating without URL parameters.
 *
 * Priority: URL params > localStorage > default value
 *
 * @example
 * ```tsx
 * // In your page component
 * const [currentPage, setCurrentPage] = useURLState('page', 1)
 * const [search, setSearch] = useURLState('search', '')
 *
 * // Add persistence
 * useAutoPersistedState('my-page-state',
 *   { currentPage, search },
 *   { currentPage: setCurrentPage, search: setSearch }
 * )
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// Current version - increment when state shape changes
const STORAGE_VERSION = 1

// State expires after 7 days of inactivity
const EXPIRY_DAYS = 7

interface PersistedData<T> {
  version: number
  timestamp: number
  data: T
}

/**
 * Hook for syncing local state with external prop changes
 * Useful for controlled inputs that need to reflect external updates (e.g., from URL restoration)
 *
 * @example
 * ```tsx
 * const [searchValue, setSearchValue] = useSyncedState(filters.search, '')
 * ```
 */
export function useSyncedState<T>(
  externalValue: T | undefined,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [internalValue, setInternalValue] = useState<T>(externalValue ?? defaultValue)
  const isFirstRender = useRef(true)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Skip first render - initial state is already set
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // Sync internal state when external value changes
    const newValue = externalValue ?? defaultValue
    if (newValue !== internalValue) {
      setInternalValue(newValue)
    }
  }, [externalValue, defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  return [internalValue, setInternalValue]
}

/**
 * Storage utilities for persisted state
 */
const storage = {
  /**
   * Save state to localStorage with version and timestamp
   */
  save<T>(key: string, data: T): boolean {
    try {
      const payload: PersistedData<T> = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        data,
      }
      localStorage.setItem(key, JSON.stringify(payload))
      return true
    } catch (e) {
      console.error(`[usePersistedURLState] Failed to save "${key}":`, e)
      return false
    }
  },

  /**
   * Load state from localStorage, validating version and expiry
   */
  load<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null

      const parsed: PersistedData<T> = JSON.parse(raw)

      // Version mismatch - clear stale data
      if (parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(key)
        return null
      }

      // Check expiry
      const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000
      if (Date.now() - parsed.timestamp > expiryMs) {
        localStorage.removeItem(key)
        return null
      }

      return parsed.data
    } catch (e) {
      console.error(`[usePersistedURLState] Failed to load "${key}":`, e)
      localStorage.removeItem(key)
      return null
    }
  },

  /**
   * Remove state from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.error(`[usePersistedURLState] Failed to remove "${key}":`, e)
    }
  },
}

/**
 * Check if URL has any query parameters
 */
function hasURLParams(searchParams: URLSearchParams): boolean {
  return searchParams.toString().length > 0
}

/**
 * Restoration state machine to prevent race conditions
 */
type RestorationPhase = 'idle' | 'restoring' | 'ready'

/**
 * Main hook for automatic state persistence
 *
 * Saves state to localStorage whenever it changes, restores on mount if URL is empty.
 * Uses a state machine to prevent race conditions between restoration and saving.
 *
 * @param storageKey - Unique localStorage key for this page
 * @param state - Current state object to persist
 * @param setters - Object mapping state keys to their setter functions
 * @param options - Configuration options
 */
export function useAutoPersistedState<T extends Record<string, unknown>>(
  storageKey: string,
  state: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setters: Record<keyof T, (value: any) => void>,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options
  const [searchParams] = useSearchParams()

  // State machine for restoration flow
  const phaseRef = useRef<RestorationPhase>('idle')
  const pendingUpdatesRef = useRef(0)

  /**
   * Phase 1: Restore from localStorage on mount (if URL is empty)
   */
  useEffect(() => {
    if (!enabled || phaseRef.current !== 'idle') return

    // URL has params - use URL values, skip restoration
    if (hasURLParams(searchParams)) {
      phaseRef.current = 'ready'
      return
    }

    // Try to restore from localStorage
    const saved = storage.load<T>(storageKey)
    if (!saved) {
      phaseRef.current = 'ready'
      return
    }

    // Begin restoration phase
    phaseRef.current = 'restoring'

    // Count how many state updates we'll trigger
    const keysToRestore = Object.entries(saved).filter(
      ([key, value]) => key in setters && value !== undefined
    )
    pendingUpdatesRef.current = keysToRestore.length

    if (pendingUpdatesRef.current === 0) {
      phaseRef.current = 'ready'
      return
    }

    // Apply restored values
    // Use requestAnimationFrame to batch updates and avoid render conflicts
    requestAnimationFrame(() => {
      keysToRestore.forEach(([key, value]) => {
        setters[key as keyof T](value)
      })
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled])

  /**
   * Phase 2: Track state updates to know when restoration is complete
   */
  useEffect(() => {
    if (!enabled) return

    // During restoration, count down pending updates
    if (phaseRef.current === 'restoring') {
      if (pendingUpdatesRef.current > 0) {
        pendingUpdatesRef.current--
      }

      // All updates applied - ready to save
      if (pendingUpdatesRef.current === 0) {
        // Small delay to ensure React has flushed all updates
        requestAnimationFrame(() => {
          phaseRef.current = 'ready'
        })
      }
      return
    }

    // Ready phase - save state changes
    if (phaseRef.current === 'ready') {
      storage.save(storageKey, state)
    }
  }, [storageKey, state, enabled])

  /**
   * Clear persisted state
   */
  const clear = useCallback(() => {
    if (!enabled) return
    storage.remove(storageKey)
  }, [storageKey, enabled])

  return { clear }
}

/**
 * Detect period option from date range
 * Used to restore period dropdown state from persisted dates
 */
export function detectPeriodFromDates(
  startDate: string | undefined,
  endDate: string | undefined
): 'any' | 'today' | 'yesterday' | 'last_7' | 'last_30' | 'last_90' | 'this_year' {
  if (!startDate || !endDate) return 'any'

  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const isEndToday = end.toDateString() === today.toDateString()

  if (!isEndToday) return 'any'

  if (daysDiff === 0) return 'today'
  if (daysDiff === 1) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (start.toDateString() === yesterday.toDateString()) return 'yesterday'
  }
  if (daysDiff === 7) return 'last_7'
  if (daysDiff === 30) return 'last_30'
  if (daysDiff === 90) return 'last_90'

  // Check for this year
  const yearStart = new Date(today.getFullYear(), 0, 1)
  if (start.toDateString() === yearStart.toDateString()) return 'this_year'

  return 'any'
}

// Re-export for backwards compatibility
export { storage as persistedStateStorage }
