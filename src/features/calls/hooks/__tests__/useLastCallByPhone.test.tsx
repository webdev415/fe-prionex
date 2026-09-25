import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLastCallByPhone } from '../useLastCallByPhone'
import { callService } from '../../api/callService'

vi.mock('../../api/callService')

const PHONE = '380978170286'

/** The app's own defaults (src/main.tsx): a five-minute staleTime. The plain
 *  wrapper below omits it, which is why nothing here caught the stale-answer
 *  bug — a fresh client makes every query look uncached. */
function createAppLikeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 1000 * 60 * 5 },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useLastCallByPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the instant of the last call', async () => {
    vi.mocked(callService.getLastCallByPhone).mockResolvedValue({
      last_call: { initiated_at: '2026-03-12T14:05:00Z', outcome: 'answered' },
    })

    const { result } = renderHook(() => useLastCallByPhone(PHONE), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lastCallAt).toBe('2026-03-12T14:05:00Z')
    expect(result.current.outcome).toBe('answered')
  })

  it('reports null for a number nobody has ever called', async () => {
    vi.mocked(callService.getLastCallByPhone).mockResolvedValue({ last_call: null })

    const { result } = renderHook(() => useLastCallByPhone(PHONE), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lastCallAt).toBeNull()
    expect(result.current.outcome).toBeNull()
  })

  it('is loading before the answer arrives, so the panel cannot say "Never" too early', async () => {
    // The distinction this hook exists to preserve: an unresolved query and a
    // resolved `last_call: null` both have no instant, and only isLoading
    // tells them apart.
    let release: (value: { last_call: null }) => void = () => {}
    vi.mocked(callService.getLastCallByPhone).mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const { result } = renderHook(() => useLastCallByPhone(PHONE), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.lastCallAt).toBeNull()

    release({ last_call: null })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('asks nothing at all until there is a number to ask about', () => {
    // The panel is closed: no phone, no request, and not "loading" either.
    const { result } = renderHook(() => useLastCallByPhone(null), { wrapper: createWrapper() })

    expect(callService.getLastCallByPhone).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.lastCallAt).toBeNull()
  })

  it('asks again when the panel is reopened, despite the app-wide 5-minute cache', async () => {
    // Review M3. The operator calls the number FROM this panel; replaying the
    // pre-call answer would state "Never" about someone they just dialled.
    vi.mocked(callService.getLastCallByPhone).mockResolvedValue({ last_call: null })
    const wrapper = createAppLikeWrapper()

    const first = renderHook(() => useLastCallByPhone(PHONE), { wrapper })
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    expect(callService.getLastCallByPhone).toHaveBeenCalledTimes(1)

    first.unmount()
    // One tick, because react-query schedules garbage collection rather than
    // running it inside unmount. Reopening a panel always costs at least this
    // much — it takes a click — so the wait is the realistic case, not a
    // convenience for the assertion below.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const second = renderHook(() => useLastCallByPhone(PHONE), { wrapper })
    // Loading, not a cached value rendered as fact: with gcTime 0 the entry is
    // gone, so the panel shows "…" rather than the pre-call answer. Under the
    // app default it would still be cached here and this would read false.
    expect(second.result.current.isLoading).toBe(true)
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))
    expect(callService.getLastCallByPhone).toHaveBeenCalledTimes(2)
  })

  it('keeps two numbers apart rather than sharing one answer', async () => {
    // Both panels can be opened from the same comment; a shared cache entry
    // would show one number's history under the other.
    const other = '380501112233'
    vi.mocked(callService.getLastCallByPhone).mockImplementation(async (phone: string) =>
      phone === PHONE
        ? { last_call: { initiated_at: '2026-03-12T14:05:00Z', outcome: 'answered' } }
        : { last_call: null }
    )

    const wrapper = createWrapper()
    const first = renderHook(() => useLastCallByPhone(PHONE), { wrapper })
    const second = renderHook(() => useLastCallByPhone(other), { wrapper })

    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))

    expect(first.result.current.lastCallAt).toBe('2026-03-12T14:05:00Z')
    expect(second.result.current.lastCallAt).toBeNull()
  })
})
