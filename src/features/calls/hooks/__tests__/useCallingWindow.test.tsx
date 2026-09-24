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
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

import { act } from '@testing-library/react'
import { toast } from 'sonner'
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

describe('useCallingWindow client scoping', () => {
  it('asks about the debtor, so the button matches what origination decides', async () => {
    // Origination resolves the window in the debtor's own zone, so a Canary
    // and a mainland debtor in one project differ by an hour. Without the
    // client the button could be enabled for a call that returns 403.
    mocked.getCallingWindowStatus.mockResolvedValue({
      allowed: true,
      reason: null,
      detail: null,
    })
    const { result } = renderHook(() => useCallingWindow(42), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mocked.getCallingWindowStatus).toHaveBeenCalledWith(42)
  })

  it('keeps separate answers per debtor rather than one shared one', async () => {
    mocked.getCallingWindowStatus.mockImplementation((id?: number | null) =>
      Promise.resolve({
        allowed: id === 1,
        reason: id === 1 ? null : 'before_window_start',
        detail: null,
      })
    )
    const wrapper = createWrapper()
    const a = renderHook(() => useCallingWindow(1), { wrapper })
    const b = renderHook(() => useCallingWindow(2), { wrapper })
    await waitFor(() => expect(a.result.current.isLoading).toBe(false))
    await waitFor(() => expect(b.result.current.isLoading).toBe(false))
    expect(a.result.current.allowed).toBe(true)
    expect(b.result.current.allowed).toBe(false)
  })
})

describe('reportBlocked — a press on a button the window disabled', () => {
  const CLOSED = { allowed: false, reason: 'after_window_end' as const, detail: '20:46' }

  async function blockedHook(clientId: number | null = 501) {
    mocked.getCallingWindowStatus.mockResolvedValue(CLOSED)
    const hook = renderHook(() => useCallingWindow(clientId), { wrapper: createWrapper() })
    await waitFor(() => expect(hook.result.current.allowed).toBe(false))
    return hook
  }

  it('shows the reason straight away, without waiting for the server', async () => {
    let finish: (v: unknown) => void = () => {}
    mocked.reportBlockedCallAttempt.mockReturnValue(new Promise((r) => (finish = r)) as never)
    const { result } = await blockedHook()

    act(() => result.current.reportBlocked())

    expect(toast.warning).toHaveBeenCalledWith('pages.calls.callingWindow.outsideHours')
    finish({ recorded: true, allowed: false, reason: 'after_window_end', detail: '20:46' })
  })

  it('records the attempt against the debtor being called', async () => {
    mocked.reportBlockedCallAttempt.mockResolvedValue({
      recorded: true,
      allowed: false,
      reason: 'after_window_end',
      detail: '20:46',
    })
    const { result } = await blockedHook(501)

    act(() => result.current.reportBlocked())

    await waitFor(() => expect(mocked.reportBlockedCallAttempt).toHaveBeenCalledWith(501))
  })

  it('writes one record per press, not a burst for a double-click', async () => {
    // Both presses inside one act, with no render between them — the case a
    // guard read from render state lets through.
    let finish: (v: unknown) => void = () => {}
    mocked.reportBlockedCallAttempt.mockReturnValue(new Promise((r) => (finish = r)) as never)
    const { result } = await blockedHook()

    act(() => {
      result.current.reportBlocked()
      result.current.reportBlocked()
    })
    // mutate() reaches the request on a later tick, so a duplicate would not
    // show yet — give it every chance to land before counting.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(mocked.reportBlockedCallAttempt).toHaveBeenCalledTimes(1)
    finish({ recorded: true, allowed: false, reason: null, detail: null })
  })

  it('records the next press once the first has been answered', async () => {
    // A guard that never reset would silently drop every later attempt.
    mocked.reportBlockedCallAttempt.mockResolvedValue({
      recorded: true,
      allowed: false,
      reason: 'after_window_end',
      detail: '20:46',
    })
    const { result } = await blockedHook()

    act(() => result.current.reportBlocked())
    await waitFor(() => expect(mocked.reportBlockedCallAttempt).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    act(() => result.current.reportBlocked())

    await waitFor(() => expect(mocked.reportBlockedCallAttempt).toHaveBeenCalledTimes(2))
  })

  it('re-checks the window when the server says it has opened', async () => {
    // Nothing is recorded in that case; the page's refusal was stale, and the
    // button should come back rather than keep refusing a legal call.
    mocked.reportBlockedCallAttempt.mockResolvedValue({
      recorded: false,
      allowed: true,
      reason: null,
      detail: null,
    })
    const { result } = await blockedHook()
    const before = mocked.getCallingWindowStatus.mock.calls.length

    act(() => result.current.reportBlocked())

    await waitFor(() =>
      expect(mocked.getCallingWindowStatus.mock.calls.length).toBeGreaterThan(before)
    )
  })

  it('does not let a failed report vanish', async () => {
    // The operator is not told — they already have the refusal on screen and
    // can do nothing about it — but the loss has to be visible to whoever
    // runs the system.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocked.reportBlockedCallAttempt.mockRejectedValue(new Error('gateway down'))
    const { result } = await blockedHook()

    act(() => result.current.reportBlocked())

    await waitFor(() =>
      expect(logged).toHaveBeenCalledWith(
        'Could not record a blocked call attempt',
        expect.any(Error)
      )
    )
    logged.mockRestore()
  })
})
