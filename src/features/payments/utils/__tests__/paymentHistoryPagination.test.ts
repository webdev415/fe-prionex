import { describe, expect, it } from 'vitest'

import { getPaymentHistoryPagination } from '../paymentHistoryPagination'

describe('getPaymentHistoryPagination', () => {
  it('derives totalPages from the server total, not one page length', () => {
    expect(getPaymentHistoryPagination(25, 1, 10).totalPages).toBe(3)
    expect(getPaymentHistoryPagination(10, 1, 10).totalPages).toBe(1)
    expect(getPaymentHistoryPagination(11, 1, 10).totalPages).toBe(2)
  })

  it('reports a reachable, correct range on page 2 (the reported bug)', () => {
    const { totalPages, rangeStart, rangeEnd } = getPaymentHistoryPagination(25, 2, 10)
    expect(totalPages).toBe(3)
    expect(rangeStart).toBe(11)
    expect(rangeEnd).toBe(20)
  })

  it('clamps the last page range to the total', () => {
    const { rangeStart, rangeEnd } = getPaymentHistoryPagination(25, 3, 10)
    expect(rangeStart).toBe(21)
    expect(rangeEnd).toBe(25)
  })

  it('returns an empty range and zero pages when there are no payments', () => {
    expect(getPaymentHistoryPagination(0, 1, 10)).toEqual({
      totalPages: 0,
      rangeStart: 0,
      rangeEnd: 0,
    })
  })

  it('treats a negative total as empty', () => {
    expect(getPaymentHistoryPagination(-5, 1, 10)).toEqual({
      totalPages: 0,
      rangeStart: 0,
      rangeEnd: 0,
    })
  })

  it('does not divide by zero when pageSize is 0', () => {
    expect(getPaymentHistoryPagination(25, 1, 0).totalPages).toBe(0)
  })
})
