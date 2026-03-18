/**
 * Unit tests for useURLState hook
 *
 * Tests URL parameter state management with:
 * - Initialization with default values
 * - Parsing values from URL parameters
 * - Updating URL on value changes
 * - Debouncing URL updates
 * - Type-safe serialization/deserialization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useURLState } from '../useURLState'

// Mock useSearchParams
const mockSetSearchParams = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }
})

describe('useURLState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset URL params
    mockSearchParams.delete('test')
    mockSearchParams.delete('count')
    mockSearchParams.delete('tags')
  })

  describe('Initialization', () => {
    it('should initialize with default value when URL param is missing', () => {
      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toBe('default')
    })

    it('should parse value from URL parameter', () => {
      mockSearchParams.set('test', 'value')

      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toBe('value')
    })

    it('should parse number from URL parameter', () => {
      mockSearchParams.set('count', '42')

      const { result } = renderHook(() => useURLState<number>('count', 0), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toBe(42)
    })

    it('should parse array from URL parameter', () => {
      mockSearchParams.set('tags', 'HIGH,MEDIUM,LOW')

      const { result } = renderHook(() => useURLState<string[]>('tags', []), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toEqual(['HIGH', 'MEDIUM', 'LOW'])
    })

    it('should parse boolean from URL parameter', () => {
      mockSearchParams.set('assigned', 'true')

      const { result } = renderHook(() => useURLState<boolean>('assigned', false), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toBe(true)
    })
  })

  describe('URL Updates', () => {
    it('should update URL when value changes', async () => {
      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1]('new-value')
      })

      // Wait for debounce (default 300ms)
      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const callArg = mockSetSearchParams.mock.calls[0][0]
      const params = typeof callArg === 'function' ? callArg(new URLSearchParams()) : callArg
      expect(params.get('test')).toBe('new-value')
    })

    it('should remove URL param when value equals default', async () => {
      mockSearchParams.set('test', 'custom')

      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1]('default')
      })

      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const callArg = mockSetSearchParams.mock.calls[0][0]
      const params = typeof callArg === 'function' ? callArg(new URLSearchParams()) : callArg
      expect(params.has('test')).toBe(false)
    })

    it('should serialize array to comma-separated string', async () => {
      const { result } = renderHook(() => useURLState<string[]>('tags', []), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1](['HIGH', 'MEDIUM', 'LOW'])
      })

      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const callArg = mockSetSearchParams.mock.calls[0][0]
      const params = typeof callArg === 'function' ? callArg(new URLSearchParams()) : callArg
      expect(params.get('tags')).toBe('HIGH,MEDIUM,LOW')
    })

    it('should serialize number to string', async () => {
      const { result } = renderHook(() => useURLState<number>('page', 1), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1](5)
      })

      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const callArg = mockSetSearchParams.mock.calls[0][0]
      const params = typeof callArg === 'function' ? callArg(new URLSearchParams()) : callArg
      expect(params.get('page')).toBe('5')
    })
  })

  describe('Debouncing', () => {
    it('should debounce URL updates with default 300ms delay', async () => {
      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      // Make rapid changes
      act(() => {
        result.current[1]('value1')
        result.current[1]('value2')
        result.current[1]('value3')
      })

      // Should not update immediately
      expect(mockSetSearchParams).not.toHaveBeenCalled()

      // Wait for debounce
      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      // Should only call once with final value
      expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
      const callArg = mockSetSearchParams.mock.calls[0][0]
      const params = typeof callArg === 'function' ? callArg(new URLSearchParams()) : callArg
      expect(params.get('test')).toBe('value3')
    })

    it('should respect custom debounce delay', async () => {
      const { result } = renderHook(() => useURLState('test', 'default', { debounce: 100 }), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1]('new-value')
      })

      // Wait for custom debounce (100ms)
      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 200 }
      )
    })
  })

  describe('History Management', () => {
    it('should use replace by default', async () => {
      const { result } = renderHook(() => useURLState('test', 'default'), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1]('new-value')
      })

      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const options = mockSetSearchParams.mock.calls[0][1]
      expect(options?.replace).toBe(true)
    })

    it('should push to history when replace is false', async () => {
      const { result } = renderHook(() => useURLState('test', 'default', { replace: false }), {
        wrapper: BrowserRouter,
      })

      act(() => {
        result.current[1]('new-value')
      })

      await waitFor(
        () => {
          expect(mockSetSearchParams).toHaveBeenCalled()
        },
        { timeout: 500 }
      )

      const options = mockSetSearchParams.mock.calls[0][1]
      expect(options?.replace).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      mockSearchParams.set('tags', '')

      const { result } = renderHook(() => useURLState<string[]>('tags', []), {
        wrapper: BrowserRouter,
      })

      expect(result.current[0]).toEqual([])
    })

    it('should handle invalid number gracefully', () => {
      mockSearchParams.set('count', 'invalid')

      const { result } = renderHook(() => useURLState<number>('count', 0), {
        wrapper: BrowserRouter,
      })

      // Should fallback to default
      expect(result.current[0]).toBe(0)
    })

    it('should handle invalid boolean gracefully', () => {
      mockSearchParams.set('flag', 'invalid')

      const { result } = renderHook(() => useURLState<boolean>('flag', false), {
        wrapper: BrowserRouter,
      })

      // Should fallback to default
      expect(result.current[0]).toBe(false)
    })
  })
})
