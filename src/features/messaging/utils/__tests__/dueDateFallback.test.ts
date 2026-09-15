import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildClientMessagingVariables } from '../clientMessagingVariables'
import { renderMessagingTemplate } from '../renderMessagingTemplate'

const base = {
  clientName: 'Kovalchuk Olena',
  clientDisplayName: 'Olena',
}

describe('the date a message tells the client to pay by', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the promise date when the client has given one', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      clientData: { max_promise_to_pay_date: '2026-03-01' } as never,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(vars.due_date).toBe('01.03.2026')
  })

  it('falls back to today when there is no promise date', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      clientData: { max_promise_to_pay_date: null } as never,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(vars.due_date).toBe('14.09.2026')
  })

  it('ignores the closing date of a reopened credit and uses today', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      clientData: {
        debts: [
          {
            contract_number: 'DV-2026-2-1',
            credit_closed_date: '2025-01-13',
            credit_reopened_date: '2025-02-01',
          },
        ],
        max_promise_to_pay_date: null,
      } as never,
      selectedLoan: { loanNumber: 'DV-2026-2-1', totalToRepay: 65292.5 },
      hasLoanContext: true,
    })

    expect(vars.due_date).toBe('14.09.2026')
  })

  it('never leaves the placeholder in the message', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      clientData: { max_promise_to_pay_date: null } as never,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(renderMessagingTemplate('Pay by {{due_date}}', vars)).toBe('Pay by 14.09.2026')
  })

  it('keeps the promise date ahead of today', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      clientData: { max_promise_to_pay_date: '2026-03-01' } as never,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(vars.due_date).not.toBe('14.09.2026')
  })
})
