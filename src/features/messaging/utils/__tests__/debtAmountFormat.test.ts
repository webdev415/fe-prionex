import { describe, expect, it } from 'vitest'
import { buildClientMessagingVariables } from '../clientMessagingVariables'
import { renderMessagingTemplate } from '../renderMessagingTemplate'

function amountFor(totalToRepay: number) {
  return buildClientMessagingVariables({
    clientName: 'Yakovenko Oksana',
    clientDisplayName: 'Yakovenko O. O.',
    clientData: { debts: [] } as never,
    selectedLoan: { loanNumber: '107486', totalToRepay },
    hasLoanContext: true,
  })
}

describe('the amount a message quotes', () => {
  it('is a bare two-decimal number, the same as the sms modal and campaigns send', () => {
    expect(amountFor(27911).debt_amount).toBe('27911.00')
  })

  it('leaves the currency to the template, so it appears once', () => {
    const text = renderMessagingTemplate('сума: {{debt_amount}} грн.', amountFor(27911))

    expect(text).toBe('сума: 27911.00 грн.')
    expect(text).not.toContain('₴')
  })

  it('keeps two decimals when there are cents', () => {
    expect(amountFor(15817.5).debt_amount).toBe('15817.50')
    expect(amountFor(33228.4).debt_amount).toBe('33228.40')
  })

  it('leaves the amount empty rather than quoting NaN', () => {
    expect(amountFor(Number.NaN).debt_amount).toBe('')
  })
})
