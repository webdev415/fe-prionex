import { describe, expect, it } from 'vitest'

import type { Payment } from '@/features/payments/api/types'

import { convertPaymentToReceiptData } from '../receiptGenerator'

// KAN-782: legacy bulk-upload rows can have a null payment_date. The receipt
// converter must not assume a string — the labeled "Payment Date" shows "—",
// and dateIssued falls back to a real timestamp rather than substituting it.
describe('convertPaymentToReceiptData — null payment_date (KAN-782)', () => {
  const basePayment = {
    id: 1,
    payment_number: 'PAY-20260101-00001',
    project_id: 1,
    client_id: 100,
    amount: '150.00',
    payment_method: 'cash',
    status: 'verified',
    payment_date: null,
    recorded_at: '2026-01-02T10:00:00Z',
    verified_at: '2026-01-03T10:00:00Z',
  } as unknown as Payment

  it('renders "—" for the Payment Date when payment_date is null', () => {
    const receipt = convertPaymentToReceiptData(basePayment)
    expect(receipt.paymentDate).toBe('—')
  })

  it('falls back to a real timestamp for dateIssued (never "—" when one exists)', () => {
    const receipt = convertPaymentToReceiptData(basePayment)
    // recorded_at is present, so dateIssued uses it, not the null payment_date.
    expect(receipt.dateIssued).toBe('2026-01-02T10:00:00Z')
  })

  it('still uses the real date when payment_date is present', () => {
    const withDate = { ...basePayment, payment_date: '2026-01-05' } as unknown as Payment
    expect(convertPaymentToReceiptData(withDate).paymentDate).toBe('2026-01-05')
  })
})
