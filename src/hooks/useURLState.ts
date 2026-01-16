/**
 * useURLState Hook
 *
 * Manages state synchronized with URL parameters using React Router 6.
 * Provides type-safe URL state management with debouncing and history control.
 *
 * @example
 * ```tsx
 * const [priority, setPriority] = useURLState<string[]>('priority', [])
 * const [page, setPage] = useURLState<number>('page', 1)
 * const [assignedTo, setAssignedTo] = useURLState('assigned_to', 'me')
 * ```
 */

import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebounce } from './useDebounce'

export interface UseURLStateOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounce?: number
  /** Use replace instead of push for history (default: true) */
  replace?: boolean
}

/**
 * Type-safe URL state hook that syncs state with URL parameters
 *
 * @param key - URL parameter key
 * @param defaultValue - Default value when parameter is not in URL
 * @param options - Configuration options
 * @returns Tuple of [value, setValue] similar to useState
 */
export function useURLState<T = string>(
  key: string,
  defaultValue: T,
  options: UseURLStateOptions = {}
): [T, Dispatch<SetStateAction<T>>] {
  const { debounce = 300, replace = true } = options
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse value from URL parameter
  const parseValue = useCallback(
    (urlValue: string | null): T => {
      if (urlValue === null) {
        return defaultValue
      }

      // Infer type from defaultValue
      const type = typeof defaultValue

      try {
        // Handle arrays (comma-separated strings)
        if (Array.isArray(defaultValue)) {
          if (urlValue === '') {
            return [] as T
          }
          const items = urlValue.split(',')

          // Try to detect if this should be a number array
          // Check if default array has numbers, or if all items look like numbers
          const shouldBeNumbers =
            (defaultValue.length > 0 && typeof defaultValue[0] === 'number') ||
            items.every((item) => !isNaN(Number(item)) && item.trim() !== '')

          if (shouldBeNumbers) {
            return items.map(Number) as T
          }
          return items as T
        }

        // Handle numbers
        if (type === 'number') {
          const parsed = Number(urlValue)
          if (isNaN(parsed)) {
            return defaultValue
          }
          return parsed as T
        }

        // Handle booleans
        if (type === 'boolean') {
          if (urlValue === 'true') return true as T
          if (urlValue === 'false') return false as T
          return defaultValue
        }

        // Handle strings
        return urlValue as T
      } catch {
        return defaultValue
      }
    },
    [defaultValue]
  )

  // Get current value from URL
  const urlValue = searchParams.get(key)
  const currentValue = parseValue(urlValue)

  // Local state for immediate updates (before debounce)
  const [pendingValue, setPendingValue] = useState<T>(currentValue)

  // Debounced value for URL updates
  const debouncedValue = useDebounce(pendingValue, debounce)

  // Update URL when debounced value changes
  useEffect(() => {
    // Use JSON comparison for deep equality (handles arrays, objects)
    if (JSON.stringify(debouncedValue) === JSON.stringify(currentValue)) {
      return // No change needed
    }

    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)

        // Serialize value to string
        const serializedValue = serializeValue(debouncedValue, defaultValue)

        if (serializedValue === null) {
          // Remove parameter if value equals default
          params.delete(key)
        } else {
          params.set(key, serializedValue)
        }

        return params
      },
      { replace }
    )
  }, [debouncedValue, currentValue, key, defaultValue, replace, setSearchParams])

  // Track if the URL value has changed (for external URL changes like browser back/forward)
  const [lastSyncedUrlValue, setLastSyncedUrlValue] = useState<string | null>(urlValue)

  // Sync local state only when URL changes externally (e.g., browser back/forward)
  // NOT when the local pendingValue changes
  useEffect(() => {
    // Only sync if the URL actually changed (not if pendingValue changed)
    if (urlValue !== lastSyncedUrlValue) {
      setLastSyncedUrlValue(urlValue)
      setPendingValue(currentValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue, lastSyncedUrlValue, key])

  return [pendingValue, setPendingValue]
}

/**
 * Serialize value to URL parameter string
 * Returns null if value equals default (to remove parameter)
 */
function serializeValue<T>(value: T, defaultValue: T): string | null {
  // Remove parameter if value equals default
  if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
    return null
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(',')
  }

  // Handle numbers and booleans
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  // Handle strings
  return value as string
}
