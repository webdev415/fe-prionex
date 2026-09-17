/**
 * The calling-window status the UI reflects (KAN-1107).
 *
 * The decisions worth pinning are the failure ones: a status check that
 * cannot answer must not disable calling for projects that have no window,
 * and a refusal must name the right cause so the operator asks the right
 * person.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CallingWindowReason } from '../../types'

vi.mock('../../api/callService')

import { callService } from '../../api/callService'
import { useCallingWindow, reasonMessage } from '../useCallingWindow'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const mocked = vi.mocked(callService)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCallingWindow', () => {
  it('allows calling when the window is open', async () => {
    mocked.getCallingWindowStatus.mockResolvedValue({
      allowed: true,
      reason: null,
      detail: null,
    })
    const { result } = renderHook(() => useCallingWindow(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.allowed).toBe(true)
    expect(result.current.message).toBeNull()
  })

  it('blocks with a reason when the window is shut', async () => {
    mocked.getCallingWindowStatus.mockResolvedValue({
      allowed: false,
      reason: 'after_window_end',
      detail: '20:46 is at or after 20:45',
    })
    const { result } = renderHook(() => useCallingWindow(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.allowed).toBe(false))
    expect(result.current.message).toBeTruthy()
  })

  it('does not block calling when the status check itself fails', async () => {
    // The server is the control. A failed status request must not take
    // calling away from Ukrainian projects that have no window at all.
    mocked.getCallingWindowStatus.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCallingWindow(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.allowed).toBe(true)
  })

  it('assumes allowed while the first check is still in flight', () => {
    mocked.getCallingWindowStatus.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCallingWindow(), { wrapper: createWrapper() })
    expect(result.current.allowed).toBe(true)
  })
})

describe('reasonMessage', () => {
  const t = (_key: string, fallback: string) => fallback

  it.each([
    ['before_window_start', 'Outside the allowed calling hours'],
    ['after_window_end', 'Outside the allowed calling hours'],
    ['weekday_not_allowed', 'Calls are not allowed today'],
    ['public_holiday', 'Today is a public holiday'],
  ])('maps %s to its own wording', (reason, expected) => {
    expect(reasonMessage(t, reason as CallingWindowReason)).toBe(expected)
  })

  it('tells the operator a missing calendar is not a holiday', () => {
    // Both refuse the call, but "today is a holiday" sends the operator home
    // to wait; a missing calendar needs an administrator.
    const missing = reasonMessage(t, 'holiday_calendar_missing')
    expect(missing).not.toBe(reasonMessage(t, 'public_holiday'))
    expect(missing).toMatch(/calendar/i)
  })

  it.each(['timezone_unresolved', 'window_misconfigured'])(
    'reports %s as unavailable, not as outside the hours',
    (reason) => {
      // Saying "outside the hours" for a broken control sends the operator to
      // wait until 09:00 instead of to whoever can fix the configuration.
      const message = reasonMessage(t, reason as CallingWindowReason)
      expect(message).toBe('Calling hours cannot be checked right now')
      expect(message).not.toBe(reasonMessage(t, 'after_window_end'))
    }
  )

  it('has a fallback for a reason it does not know', () => {
    expect(reasonMessage(t, 'something_new' as CallingWindowReason)).toBeTruthy()
  })
})
