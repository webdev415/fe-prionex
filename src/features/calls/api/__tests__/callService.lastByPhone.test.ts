import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { callService } from '../callService'
import type { LastCallByPhoneResponse } from '../../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: mockApi }))

const PHONE = '380978170286'

describe('callService.getLastCallByPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks the literal last-by-phone route, with the number as a query param', () => {
    // The path is asserted by suffix rather than in full: API_BASE_URL comes
    // from VITE_API_BASE_URL, so pinning the whole URL would make this test
    // depend on the environment it runs in rather than on the code.
    mockApi.get.mockResolvedValue({ data: { last_call: null } })

    callService.getLastCallByPhone(PHONE)

    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/calls/last-by-phone'),
      { params: { phone: PHONE } }
    )
  })

  it('sends the digits through untouched', async () => {
    // The endpoint matches both the bare and the +-prefixed stored forms, so
    // the client must not "helpfully" reshape the number first.
    mockApi.get.mockResolvedValue({ data: { last_call: null } })

    await callService.getLastCallByPhone(PHONE)

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params.phone).toBe(PHONE)
  })

  it('returns the call when the number has been dialled before', async () => {
    const payload: LastCallByPhoneResponse = {
      last_call: { initiated_at: '2026-03-12T14:05:00Z', outcome: 'answered' },
    }
    mockApi.get.mockResolvedValue({ data: payload })

    await expect(callService.getLastCallByPhone(PHONE)).resolves.toEqual(payload)
  })

  it('returns a null last_call rather than throwing for a never-called number', async () => {
    // The endpoint answers 200 with `{ last_call: null }` on purpose: never
    // called is an ordinary fact about a real number, not a missing resource.
    mockApi.get.mockResolvedValue({ data: { last_call: null } })

    const result = await callService.getLastCallByPhone(PHONE)

    expect(result.last_call).toBeNull()
  })
})
