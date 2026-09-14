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

  it('does not date the message from a credit that was not selected', () => {
    const withClosedDebt = {
      debts: [
        {
          contract_number: 'CLOSED-001',
          debt_close_date: '2024-01-31',
          credit_closed_date: '2024-01-31',
        },
      ],
      max_promise_to_pay_date: null,
    } as never

    const vars = buildClientMessagingVariables({
      clientName: 'Kovalchuk Olena',
      clientDisplayName: 'Olena',
      clientData: withClosedDebt,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(vars.due_date).toBe('')
    expect(renderMessagingTemplate('{{due_date}}', vars)).toBe('{{due_date}}')
  })

  it('never renders an inherited object member into a message', () => {
    const vars = buildClientMessagingVariables({
      clientName: 'Kovalchuk Olena',
      clientDisplayName: 'Olena',
      clientData,
      selectedLoan: null,
      hasLoanContext: true,
    })

    expect(renderMessagingTemplate('Hello {{constructor}}', vars)).toBe('Hello {{constructor}}')
    expect(renderMessagingTemplate('{{toString}}', vars)).toBe('{{toString}}')
  })
})
