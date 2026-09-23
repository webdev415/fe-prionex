import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLastCallByPhone } from '../useLastCallByPhone'
import { callService } from '../../api/callService'

vi.mock('../../api/callService')

const PHONE = '380978170286'

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
