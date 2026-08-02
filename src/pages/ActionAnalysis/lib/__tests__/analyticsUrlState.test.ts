import { describe, it, expect } from 'vitest'
import { toAnalyticsRangeFilters, type AnalyticsBarState } from '../analyticsUrlState'

describe('toAnalyticsRangeFilters', () => {
  it('sends ISO datetimes for a custom range (not bare YYYY-MM-DD)', () => {
    const state: AnalyticsBarState = {
      period: 'custom',
      customFromDate: '2026-04-14',
      customToDate: '2026-04-20',
    }
    const filters = toAnalyticsRangeFilters(state)
    expect(filters.period).toBe('custom')
    // Full ISO — parseable by the backend's `datetime` params.
    expect(filters.from_date).toMatch(/T.*Z$/)
    expect(filters.to_date).toMatch(/T.*Z$/)
    // Not the raw date-only strings that pydantic 2.5 rejects.
    expect(filters.from_date).not.toBe('2026-04-14')
    expect(filters.to_date).not.toBe('2026-04-20')
  })

  it('omits from_date/to_date for preset periods', () => {
    const filters = toAnalyticsRangeFilters({ period: 'last_7d' })
    expect(filters.period).toBe('last_7d')
    expect(filters.from_date).toBeUndefined()
    expect(filters.to_date).toBeUndefined()
  })
})
