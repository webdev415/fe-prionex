/**
 * URLs for the calling-window API (KAN-1107).
 *
 * Pinned because a wrong path here fails only at runtime: the country
 * catalogue first lived at /api/v1/projects/holiday-countries, where
 * GET /api/v1/projects/{project_id} matched it first and rejected
 * "holiday-countries" as a non-integer project id. Every unit test still
 * passed, because none of them went over HTTP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { getHolidayCountries, getSubdivisions, getCallingWindow } from '../callingWindowApi'

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: [] })
})

describe('calling window API paths', () => {
  it('reads the country catalogue outside the /projects/ prefix', async () => {
    await getHolidayCountries()
    const url = get.mock.calls[0][0] as string
    expect(url).toBe('/api/v1/calling-window/countries')
    expect(url.startsWith('/api/v1/projects/')).toBe(false)
  })

  it('reads subdivisions outside the /projects/ prefix', async () => {
    await getSubdivisions('ES')
    const url = get.mock.calls[0][0] as string
    expect(url).toBe('/api/v1/calling-window/countries/ES/subdivisions')
    expect(url.startsWith('/api/v1/projects/')).toBe(false)
  })

  it('keeps the per-project window under its project id', async () => {
    get.mockResolvedValue({ data: {} })
    await getCallingWindow(7)
    expect(get.mock.calls[0][0]).toBe('/api/v1/projects/7/calling-window')
  })
})
