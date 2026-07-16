import { describe, it, expect } from 'vitest'
import { formatSegmentFilterMeta } from '../segmentFilterMeta'

const t = (key: string, opts?: Record<string, unknown>) => {
  if (key.endsWith('segmentClients')) return `${opts?.count} clients`
  if (key.endsWith('segmentMeta')) return `${opts?.clients} · updated at ${opts?.time}`
  return key
}

describe('formatSegmentFilterMeta', () => {
  it('shows count only when never refreshed', () => {
    expect(
      formatSegmentFilterMeta({ cached_client_count: 42, last_refreshed_at: undefined }, t)
    ).toBe('42 clients')
  })

  it('includes updated time when last_refreshed_at is set', () => {
    const result = formatSegmentFilterMeta(
      { cached_client_count: 1240, last_refreshed_at: '2026-07-16T14:32:00Z' },
      t
    )
    expect(result).toMatch(/^1240 clients · updated at \d{2}:\d{2}$/)
  })

  it('falls back to count for invalid timestamps', () => {
    expect(
      formatSegmentFilterMeta({ cached_client_count: 3, last_refreshed_at: 'not-a-date' }, t)
    ).toBe('3 clients')
  })
})
