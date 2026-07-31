import { describe, expect, it } from 'vitest'

import type { DebtDetail } from '@/features/clients/api/types'
import type { Payment } from '@/features/payments/api/types'

import { selectDebtForPayment } from '../receiptGenerator'

function debt(overrides: Partial<DebtDetail>): DebtDetail {
  return {
    id: 0,
    seller_id: 0,
    seller_company: '',
    contract_number: '',
    original_debt_amount: '0',
    remaining_debt_amount: '0',
    status: 'active',
    ...overrides,
  } as unknown as DebtDetail
}

function payment(overrides: Partial<Payment>): Payment {
  return overrides as unknown as Payment
}

const debtA = debt({ id: 1, seller_id: 10, contract_number: 'CONTRACT-A' })
const debtB = debt({ id: 2, seller_id: 20, contract_number: 'CONTRACT-B' })

describe('selectDebtForPayment', () => {
  it('returns the debt matching payment.debt_id', () => {
    const result = selectDebtForPayment(payment({ debt_id: 2 }), [debtA, debtB])
    expect(result).toBe(debtB)
  })

  it('receipt for a payment on the second debt uses that debt, not debts[0]', () => {
    const result = selectDebtForPayment(payment({ debt_id: 2 }), [debtA, debtB])
    expect(result?.seller_id).toBe(20)
    expect(result?.contract_number).toBe('CONTRACT-B')
  })

  it('falls back to debt_contract_number when debt_id is absent', () => {
    const result = selectDebtForPayment(payment({ debt_contract_number: 'CONTRACT-B' }), [
      debtA,
      debtB,
    ])
    expect(result).toBe(debtB)
  })

  it('falls back to debt_contract_number when debt_id has no match', () => {
    const result = selectDebtForPayment(
      payment({ debt_id: 999, debt_contract_number: 'CONTRACT-B' }),
      [debtA, debtB]
    )
    expect(result).toBe(debtB)
  })

  it('falls back to the first debt when neither id nor contract matches', () => {
    const result = selectDebtForPayment(
      payment({ debt_id: 999, debt_contract_number: 'CONTRACT-Z' }),
      [debtA, debtB]
    )
    expect(result).toBe(debtA)
  })

  it('falls back to the first debt when the payment carries no debt reference', () => {
    const result = selectDebtForPayment(payment({}), [debtA, debtB])
    expect(result).toBe(debtA)
  })

  it('returns undefined for an empty or missing debts list', () => {
    expect(selectDebtForPayment(payment({ debt_id: 1 }), [])).toBeUndefined()
    expect(selectDebtForPayment(payment({ debt_id: 1 }), undefined)).toBeUndefined()
  })
})
