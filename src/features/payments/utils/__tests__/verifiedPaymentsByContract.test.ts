import { describe, expect, it } from 'vitest'
import {
  buildPurchaseDateMap,
  buildVerifiedPaymentsByContract,
  isSystemPayment,
} from '../verifiedPaymentsByContract'

describe('verifiedPaymentsByContract', () => {
  const debts = [
    { contract_number: '24365', purchase_date: '2020-01-01' },
    { contract_number: '55747', purchase_date: '2020-01-01' },
    { contract_number: '78901', purchase_date: '2020-01-01' },
  ]

  it('aggregates only verified system payments per contract', () => {
    const purchaseDateMap = buildPurchaseDateMap(debts)
    const verified = [
      {
        debt_contract_number: '24365',
        payment_date: '2026-01-01',
        amount: '100',
      },
      {
        debt_contract_number: '24365',
        payment_date: '2026-02-01',
        amount: '200',
      },
      {
        debt_contract_number: '55747',
        payment_date: '2026-01-15',
        amount: '50',
      },
    ]

    const result = buildVerifiedPaymentsByContract(debts, verified, purchaseDateMap)

    expect(result).toHaveLength(3)
    expect(result.find((r) => r.contractNumber === '24365')).toEqual({
      contractNumber: '24365',
      totalVerified: 300,
      verifiedCount: 2,
    })
    expect(result.find((r) => r.contractNumber === '55747')).toEqual({
      contractNumber: '55747',
      totalVerified: 50,
      verifiedCount: 1,
    })
    expect(result.find((r) => r.contractNumber === '78901')).toEqual({
      contractNumber: '78901',
      totalVerified: 0,
      verifiedCount: 0,
    })
    expect(result.reduce((sum, row) => sum + row.totalVerified, 0)).toBe(350)
  })

  it('excludes primary creditor payments before purchase date', () => {
    const purchaseDateMap = buildPurchaseDateMap(debts)
    const verified = [
      {
        debt_contract_number: '24365',
        payment_date: '2019-06-01',
        amount: '999',
      },
      {
        debt_contract_number: '24365',
        payment_date: '2026-01-01',
        amount: '10',
      },
    ]

    expect(isSystemPayment(verified[0], purchaseDateMap)).toBe(false)
    expect(isSystemPayment(verified[1], purchaseDateMap)).toBe(true)

    const result = buildVerifiedPaymentsByContract(debts, verified, purchaseDateMap)
    expect(result.find((r) => r.contractNumber === '24365')?.totalVerified).toBe(10)
    expect(result.find((r) => r.contractNumber === '24365')?.verifiedCount).toBe(1)
  })

  // KAN-782: legacy bulk-upload rows can have a null payment_date.
  it('treats a null payment_date as a system payment and still aggregates it', () => {
    const purchaseDateMap = buildPurchaseDateMap(debts)
    const verified = [
      {
        debt_contract_number: '24365',
        payment_date: null,
        amount: '50',
      },
    ]

    // No date to compare against the purchase date → counted as a system payment.
    expect(isSystemPayment(verified[0], purchaseDateMap)).toBe(true)

    const result = buildVerifiedPaymentsByContract(debts, verified, purchaseDateMap)
    expect(result.find((r) => r.contractNumber === '24365')?.totalVerified).toBe(50)
    expect(result.find((r) => r.contractNumber === '24365')?.verifiedCount).toBe(1)
  })
})
