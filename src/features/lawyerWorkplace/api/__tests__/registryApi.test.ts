import { describe, it, expect, beforeEach, vi } from 'vitest'

const apiGet = vi.hoisted(() =>
  vi.fn((_url: string, _config?: unknown) => Promise.resolve({ data: { items: [], total: 0 } }))
)

vi.mock('@/lib/api', () => ({
  default: { get: apiGet },
  api: { get: apiGet },
}))

import { legalRegistryApi } from '../registryApi'

function lastCall() {
  const call = apiGet.mock.calls.at(-1)
  if (!call) throw new Error('api.get was not called')
  const [url, config] = call as [string, { params?: URLSearchParams; responseType?: string }]
  return { url, config }
}

describe('legalRegistryApi', () => {
  beforeEach(() => {
    apiGet.mockClear()
  })

  it('lists the incoming registry with filters mapped to query params', async () => {
    await legalRegistryApi.listIncoming({
      page: 2,
      limit: 25,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      letter_type_id: 'complaint',
      search: '  urgent  ',
    })

    const { url, config } = lastCall()
    expect(url).toBe('/api/v1/legal/registry/incoming')
    expect(config.params?.get('page')).toBe('2')
    expect(config.params?.get('limit')).toBe('25')
    expect(config.params?.get('date_from')).toBe('2026-07-01')
    expect(config.params?.get('date_to')).toBe('2026-07-31')
    expect(config.params?.get('letter_type_id')).toBe('complaint')
    // search is trimmed before it hits the wire
    expect(config.params?.get('search')).toBe('urgent')
  })

  it('lists the outgoing registry with the lawyer filter', async () => {
    await legalRegistryApi.listOutgoing({ lawyer_id: 42 })

    const { url, config } = lastCall()
    expect(url).toBe('/api/v1/legal/registry/outgoing')
    expect(config.params?.get('lawyer_id')).toBe('42')
  })

  it('exports the incoming registry as a CSV blob from the incoming/export endpoint', async () => {
    await legalRegistryApi.exportIncoming({ date_from: '2026-07-01' })

    const { url, config } = lastCall()
    expect(url).toBe('/api/v1/legal/registry/incoming/export')
    expect(config.responseType).toBe('blob')
    expect(config.params?.get('date_from')).toBe('2026-07-01')
    // pagination is never sent to the export endpoint
    expect(config.params?.get('page')).toBeNull()
    expect(config.params?.get('limit')).toBeNull()
  })

  it('exports the outgoing registry from the outgoing/export endpoint', async () => {
    await legalRegistryApi.exportOutgoing({ lawyer_id: 7, letter_type_id: 'nbu' })

    const { url, config } = lastCall()
    expect(url).toBe('/api/v1/legal/registry/outgoing/export')
    expect(config.responseType).toBe('blob')
    expect(config.params?.get('lawyer_id')).toBe('7')
    expect(config.params?.get('letter_type_id')).toBe('nbu')
  })
})
