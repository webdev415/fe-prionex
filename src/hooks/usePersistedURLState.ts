/**
 * usePersistedURLState Hook
 *
 * Extends useURLState with localStorage persistence for better UX.
 * Filters persist even when navigating without URL parameters.
 *
 * Priority: URL params > localStorage > default value
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = usePersistedURLState('page-key', {
 *   page: 1,
 *   search: '',
 *   status: []
 * })
 * ```
 */

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface UsePersistedURLStateOptions {
  /** Unique key for localStorage (e.g., 'client-filters', 'audit-logs-state') */
  storageKey: string
  /** Whether to enable localStorage persistence (default: true) */
  enabled?: boolean
}

/**
 * Hook that provides localStorage persistence for page state
 * Works with any state object - automatically syncs URL params with localStorage
 *
 * @param storageKey - Unique localStorage key for this page
 * @param enabled - Whether persistence is enabled (default: true)
 * @returns Object with save, restore, and clear functions
 */
export function usePersistedURLState<T extends Record<string, unknown>>(
  storageKey: string,
  enabled = true
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const hasRestoredRef = useRef(false)

  /**
   * Save current state to localStorage
   */
  const save = (state: T) => {
    if (!enabled) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch (e) {
      console.error(`Failed to save state to localStorage [${storageKey}]:`, e)
    }
  }

  /**
   * Restore state from localStorage
   * Returns null if no saved state exists or if parsing fails
   */
  const restore = (): T | null => {
    if (!enabled) return null

    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return null

      return JSON.parse(saved) as T
    } catch (e) {
      console.error(`Failed to restore state from localStorage [${storageKey}]:`, e)
      return null
    }
  }

  /**
   * Clear saved state from localStorage
   */
  const clear = () => {
    if (!enabled) return

    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      console.error(`Failed to clear localStorage [${storageKey}]:`, e)
    }
  }

  /**
   * Check if URL has any parameters
   * Returns true if URL has query params (excluding common navigation params)
   */
  const hasURLParams = () => {
    const params = new URLSearchParams(searchParams)
    // Ignore empty search params
    return params.toString().length > 0
  }

  /**
   * Auto-restore state on mount if no URL params exist
   * Note: This is not a hook itself, just returns the restore logic
   */
  const autoRestoreCallback = (
    onRestore: (state: T) => void,
    shouldRestore: () => boolean = () => !hasURLParams()
  ) => {
    if (hasRestoredRef.current || !enabled) return

    // Only restore if condition is met (default: no URL params)
    if (!shouldRestore()) {
      hasRestoredRef.current = true
      return
    }

    const savedState = restore()
    if (savedState) {
      // Use setTimeout to avoid state updates during render
      setTimeout(() => {
        onRestore(savedState)
      }, 0)
    }

    hasRestoredRef.current = true
  }

  return {
    save,
    restore,
    clear,
    hasURLParams,
    autoRestoreCallback,
    setSearchParams,
  }
}

/**
 * Helper function to check if a state object has any active filters
 * Useful for determining whether to save state to localStorage
 */
export function hasActiveFilters(state: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(state)) {
    // Skip certain keys that aren't filters
    if (key === 'page' || key === 'pageSize' || key === 'sort_by' || key === 'sort_order') {
      continue
    }

    // Check if value is non-empty
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && value === '') continue
    if (typeof value === 'number' && value === 0) continue
    if (typeof value === 'boolean' && value === false) continue
    if (Array.isArray(value) && value.length === 0) continue

    return true
  }

  return false
}

/**
 * Simpler hook for automatic state persistence
 * Saves state to localStorage whenever it changes, restores on mount
 *
 * @example
 * ```tsx
 * const [page, setPage] = useURLState('page', 1)
 * const [search, setSearch] = useURLState('search', '')
 *
 * // Add persistence
 * useAutoPersistedState('my-page-state', { page, search })
 * ```
 */
export function useAutoPersistedState<T extends Record<string, unknown>>(
  storageKey: string,
  state: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setters: Record<keyof T, (value: any) => void>,
  options: { enabled?: boolean; onlyIfActive?: boolean } = {}
) {
  const { enabled = true, onlyIfActive = true } = options
  const hasRestoredRef = useRef(false)
  const [searchParams] = useSearchParams()

  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
    if (!enabled) return

    // Only save if there are active filters (optional)
    if (onlyIfActive && !hasActiveFilters(state)) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch (e) {
      console.error(`Failed to save state [${storageKey}]:`, e)
    }
  }, [storageKey, state, enabled, onlyIfActive])

  // Auto-restore state on mount if no URL params
  useEffect(() => {
    if (hasRestoredRef.current || !enabled) return

    // Check if URL already has params
    const hasURLParams = searchParams.toString().length > 0
    if (hasURLParams) {
      hasRestoredRef.current = true
      return
    }

    // Check if state already has values (from URL or defaults)
    const hasStateValues = hasActiveFilters(state)
    if (hasStateValues) {
      hasRestoredRef.current = true
      return
    }

    // Restore from localStorage
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as T
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          for (const [key, value] of Object.entries(parsed)) {
            if (key in setters && value !== undefined) {
              setters[key as keyof T](value)
            }
          }
        }, 0)
      }
    } catch (e) {
      console.error(`Failed to restore state [${storageKey}]:`, e)
    }

    hasRestoredRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled])

  // Return clear function
  const clear = () => {
    if (!enabled) return
    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      console.error(`Failed to clear storage [${storageKey}]:`, e)
    }
  }

  return { clear }
}
