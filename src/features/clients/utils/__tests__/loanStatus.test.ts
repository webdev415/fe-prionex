import { describe, expect, it } from 'vitest'
import { isOpenLoan } from '../loanStatus'

describe('deciding whether a credit is still open', () => {
  it('excludes a closed credit', () => {
    expect(isOpenLoan({ status: 'closed' })).toBe(false)
  })

  it('ignores casing and padding, the way the stored values vary', () => {
    expect(isOpenLoan({ status: 'Closed' })).toBe(false)
    expect(isOpenLoan({ status: '  CLOSED  ' })).toBe(false)
  })

  it('keeps every other status, including ones we have not seen', () => {
    expect(isOpenLoan({ status: 'active' })).toBe(true)
    expect(isOpenLoan({ status: 'overdue' })).toBe(true)
    expect(isOpenLoan({ status: 'written_off' })).toBe(true)
  })

  it('keeps a credit whose status was never set', () => {
    expect(isOpenLoan({})).toBe(true)
    expect(isOpenLoan({ status: null })).toBe(true)
    expect(isOpenLoan({ status: '' })).toBe(true)
  })

  it('is what the message modals filter a mixed credit list with', () => {
    const clientLoans = [
      { id: 1, status: 'active' },
      { id: 2, status: 'Closed' },
      { id: 3, status: 'overdue' },
      { id: 4, status: 'closed' },
    ]

    expect(clientLoans.filter(isOpenLoan).map((l) => l.id)).toEqual([1, 3])
  })

  it('leaves nothing to select when every credit is closed', () => {
    const clientLoans = [
      { id: 1, status: 'closed' },
      { id: 2, status: 'Closed' },
    ]

    expect(clientLoans.filter(isOpenLoan)).toEqual([])
  })
})
