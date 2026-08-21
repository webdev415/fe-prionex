import { describe, expect, it } from 'vitest'
import { RETENTION_DAYS, daysUntilPurge } from '../softDeleteRetention'

const NOW = new Date('2026-08-18T12:00:00Z')

function deletedDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('daysUntilPurge', () => {
  it('counts down from the retention window', () => {
    expect(daysUntilPurge(deletedDaysAgo(0), NOW)).toBe(RETENTION_DAYS)
    expect(daysUntilPurge(deletedDaysAgo(1), NOW)).toBe(RETENTION_DAYS - 1)
    expect(daysUntilPurge(deletedDaysAgo(89), NOW)).toBe(1)
  })

  it('reports zero on the day the window closes', () => {
    expect(daysUntilPurge(deletedDaysAgo(RETENTION_DAYS), NOW)).toBe(0)
  })

  it('clamps an overdue item to zero rather than going negative', () => {
    expect(daysUntilPurge(deletedDaysAgo(200), NOW)).toBe(0)
  })

  it('returns null when there is no deletion timestamp', () => {
    // The purge filters `deleted_at < cutoff`, so such a row is never swept:
    // it has no deadline, which is different from a deadline of zero.
    expect(daysUntilPurge(null, NOW)).toBeNull()
    expect(daysUntilPurge(undefined, NOW)).toBeNull()
    expect(daysUntilPurge('', NOW)).toBeNull()
  })

  it('returns null for an unparseable timestamp instead of NaN days', () => {
    expect(daysUntilPurge('not-a-date', NOW)).toBeNull()
  })
})
