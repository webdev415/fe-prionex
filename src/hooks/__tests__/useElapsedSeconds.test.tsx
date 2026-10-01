import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useElapsedSeconds } from '../useElapsedSeconds'

/**
 * The clock behind the report tabs' loading caption (Kanbanboard#100).
 * Timers AND Date are faked together: the hook reads Date.now() on each
 * interval tick, so both have to move for a second to "pass".
 */
describe('useElapsedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays at 0 while inactive', () => {
    const { result } = renderHook(() => useElapsedSeconds(false))
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(0)
  })

  it('counts whole seconds from the moment it turns active', () => {
    const { result } = renderHook(() => useElapsedSeconds(true))
    expect(result.current).toBe(0)
    act(() => void vi.advanceTimersByTime(2999))
    expect(result.current).toBe(2)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(3)
  })

  it('follows the wall clock, not the number of ticks', () => {
    // A background tab throttles timers: one tick may arrive after many
    // seconds. The value must show the real wait, not "1".
    // The clock jumps 11 s without a tick; the one tick that follows also
    // moves the faked Date by its own 1 s.
    const { result } = renderHook(() => useElapsedSeconds(true))
    vi.setSystemTime(new Date('2026-10-01T09:00:11Z'))
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current).toBe(12)
  })

  it('drops back to 0 when inactive and counts from zero on the next phase', () => {
    const { result, rerender } = renderHook(({ on }) => useElapsedSeconds(on), {
      initialProps: { on: true },
    })
    act(() => void vi.advanceTimersByTime(7000))
    expect(result.current).toBe(7)

    rerender({ on: false })
    expect(result.current).toBe(0)

    rerender({ on: true })
    expect(result.current).toBe(0)
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current).toBe(1)
  })
})
