/**
 * KAN-1110 — the stateful half of the self-edit window.
 *
 * `canMutateInteraction` and `parseUtcTimestamp` are pure and covered next
 * door. This file covers the part that can only break in a browser: the timer.
 *
 * The finding that prompted it: `now` is seeded once at mount and otherwise
 * only advanced by the interval, so a mount that never starts a timer keeps a
 * frozen clock — and a frozen clock reads an already-closed window as open.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNowUntil } from '../useSelfEditWindow'

const T0 = Date.parse('2026-09-18T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useNowUntil', () => {
  it('ticks while the deadline is ahead', () => {
    const { result } = renderHook(() => useNowUntil(T0 + 5_000))
    expect(result.current).toBe(T0)

    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current).toBe(T0 + 2_000)
  })

  it('stops once the deadline passes, and does not keep ticking after', () => {
    const { result } = renderHook(() => useNowUntil(T0 + 3_000))

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current).toBe(T0 + 3_000)

    // Well past the deadline: the interval cleared itself, so `now` is frozen
    // at the deadline rather than continuing to advance.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe(T0 + 3_000)
  })

  it('starts no timer for a deadline already in the past', () => {
    const spy = vi.spyOn(window, 'setInterval')
    renderHook(() => useNowUntil(T0 - 1_000))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('starts no timer for a non-finite deadline (no own rows on the page)', () => {
    const spy = vi.spyOn(window, 'setInterval')
    renderHook(() => useNowUntil(Number.NaN))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('RESYNCS the clock even when it starts no timer', () => {
    // The stale-clock bug. Mount with nothing to watch, let real time pass with
    // no timer running, then hand it a deadline. Before the fix `now` was still
    // the mount value and an expired window read as open.
    const { result, rerender } = renderHook(({ d }) => useNowUntil(d), {
      initialProps: { d: 0 },
    })
    expect(result.current).toBe(T0)

    vi.setSystemTime(T0 + 20 * 60_000)
    // A deadline that has ALREADY passed — the early-return path.
    act(() => {
      rerender({ d: T0 + 10 * 60_000 })
    })
    // The resync is scheduled rather than synchronous (setState in an effect
    // body cascades renders), so let the task run.
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toBe(T0 + 20 * 60_000)
    // ...and therefore reads as closed, which is the whole point.
    expect(result.current < T0 + 10 * 60_000).toBe(false)
  })

  it('restarts when the deadline moves forward', () => {
    const { result, rerender } = renderHook(({ d }) => useNowUntil(d), {
      initialProps: { d: T0 + 1_000 },
    })
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(result.current).toBe(T0 + 1_000)

    // A newer own row arrives, pushing the deadline out; the clock must run again.
    act(() => {
      rerender({ d: T0 + 10_000 })
    })
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current).toBe(T0 + 3_000)
  })

  it('clears its interval on unmount', () => {
    const clear = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useNowUntil(T0 + 60_000))
    unmount()
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })
})
