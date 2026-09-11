import { describe, expect, it } from 'vitest'
import { buildClientMessagingVariables } from '../clientMessagingVariables'
import { renderMessagingTemplate } from '../renderMessagingTemplate'

const clientData = {
  debts: [{ contract_number: 'CLOSED-001' }],
} as never

const base = {
  clientName: 'Kovalchuk Olena',
  clientDisplayName: 'Olena',
  clientData,
}

describe('credit variables when the client has no open credit', () => {
  it('does not borrow a contract number from a closed credit', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(vars.contract_number).toBe('')
    expect(vars.debt_amount).toBe('')
  })

  it('leaves the placeholders in the message untouched', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      selectedLoan: null,
      hasLoanContext: true,
    })

    const rendered = renderMessagingTemplate(
      'Contract {{contract_number}}, amount {{debt_amount}}, hello {{client_name}}',
      vars
    )

    expect(rendered).toContain('{{contract_number}}')
    expect(rendered).toContain('{{debt_amount}}')
    expect(rendered).toContain('Olena')
  })

  it('still substitutes when a credit is selected', () => {
    const vars = buildClientMessagingVariables({
      ...base,
      selectedLoan: { loanNumber: 'OPEN-777', totalToRepay: 1234.5 },
      hasLoanContext: true,
    })

    expect(vars.contract_number).toBe('OPEN-777')
    expect(renderMessagingTemplate('{{contract_number}}', vars)).toBe('OPEN-777')
  })

  it('keeps the legacy fallback for callers that pass no credit list at all', () => {
    const vars = buildClientMessagingVariables({ ...base, selectedLoan: null })

    expect(vars.contract_number).toBe('CLOSED-001')
  })
})
