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

  it('treats naive UTC timestamps as UTC and formats in the given timezone', () => {
    // 08:20 UTC → 11:20 in Europe/Kyiv (EEST, UTC+3 in July)
    const result = formatSegmentFilterMeta(
      { cached_client_count: 2, last_refreshed_at: '2026-07-17T08:20:00' },
      t,
      'Europe/Kyiv'
    )
    expect(result).toBe('2 clients · updated at 11:20')
  })

  it('formats explicit Z timestamps in the given timezone', () => {
    const result = formatSegmentFilterMeta(
      { cached_client_count: 1240, last_refreshed_at: '2026-07-16T14:32:00Z' },
      t,
      'Europe/Kyiv'
    )
    expect(result).toBe('1240 clients · updated at 17:32')
  })

  it('falls back to count for invalid timestamps', () => {
    expect(
      formatSegmentFilterMeta({ cached_client_count: 3, last_refreshed_at: 'not-a-date' }, t)
    ).toBe('3 clients')
  })
})
