import { describe, expect, it } from 'vitest'

import { isPaymentLessThan7DaysOld } from '@/features/payments/utils'

const DAY = 24 * 60 * 60 * 1000

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString()
}

describe('isPaymentLessThan7DaysOld', () => {
  it('accepts an ISO recorded_at from today', () => {
    expect(isPaymentLessThan7DaysOld(isoDaysAgo(0))).toBe(true)
  })

  it('accepts an ISO recorded_at within the last 7 days', () => {
    expect(isPaymentLessThan7DaysOld(isoDaysAgo(3))).toBe(true)
  })

  it('rejects an ISO recorded_at older than 7 days', () => {
    expect(isPaymentLessThan7DaysOld(isoDaysAgo(10))).toBe(false)
  })

  it('accepts a space-separated UTC datetime without a Z suffix', () => {
    const value = new Date(Date.now() - 2 * DAY).toISOString().replace('T', ' ').replace('Z', '')
    expect(isPaymentLessThan7DaysOld(value)).toBe(true)
  })

  it('rejects an empty string from a NULL recorded_at', () => {
    expect(isPaymentLessThan7DaysOld('')).toBe(false)
  })
})
