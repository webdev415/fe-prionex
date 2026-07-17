import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordMutate: vi.fn(),
  verifyMutate: vi.fn(),
}))

vi.mock('@/features/payments', () => ({
  useRecordPayment: () => ({ mutate: mocks.recordMutate }),
  useVerifyPayment: () => ({ mutate: mocks.verifyMutate }),
}))
vi.mock('@/hooks/usePermissions', () => ({ useHasPermission: () => true }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { useRecordPaymentFlow, type RecordPaymentInput } from '../useRecordPaymentFlow'

function baseInput(overrides: Partial<RecordPaymentInput> = {}): RecordPaymentInput {
  return {
    amount: 100,
    date: new Date(2026, 0, 15),
    method: 'Bank Transfer',
    status: 'Pending Verification',
    generateReceipt: false,
    updateBalance: true,
    paymentType: 'payment_by_rr',
    ...overrides,
  }
}

describe('useRecordPaymentFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // KAN-705: paymentType was silently dropped because RecordPaymentInput lacked
  // the field and the request omitted payment_type.
  it('sends the operator-selected payment_type in the record request', () => {
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 42 }))
    result.current.handleRecordPayment(baseInput({ paymentType: 'payment_by_rr' }))

    expect(mocks.recordMutate).toHaveBeenCalledTimes(1)
    const request = mocks.recordMutate.mock.calls[0][0]
    expect(request.payment_type).toBe('payment_by_rr')
    expect(request.client_id).toBe(42)
    expect(request.payment_date).toBe('2026-01-15')
  })

  it('forwards partial_payment / full_payment unchanged', () => {
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 7 }))

    result.current.handleRecordPayment(baseInput({ paymentType: 'partial_payment' }))
    expect(mocks.recordMutate.mock.calls[0][0].payment_type).toBe('partial_payment')

    result.current.handleRecordPayment(baseInput({ paymentType: 'full_payment' }))
    expect(mocks.recordMutate.mock.calls[1][0].payment_type).toBe('full_payment')
  })

  // Regression guard: restructuringAgreementId must reach the request payload.
  // When dropped, a ``payment_by_rr`` save fails the backend validator
  // ("payment_type='payment_by_rr' requires restructuring_agreement_id").
  it('sends restructuring_agreement_id for payment_by_rr when provided', () => {
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 42 }))
    result.current.handleRecordPayment(
      baseInput({ paymentType: 'payment_by_rr', restructuringAgreementId: 25770 })
    )

    const request = mocks.recordMutate.mock.calls[0][0]
    expect(request.payment_type).toBe('payment_by_rr')
    expect(request.restructuring_agreement_id).toBe(25770)
  })

  it('omits restructuring_agreement_id when none is provided', () => {
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 42 }))
    result.current.handleRecordPayment(baseInput({ paymentType: 'partial_payment' }))

    const request = mocks.recordMutate.mock.calls[0][0]
    expect(request.restructuring_agreement_id).toBeUndefined()
  })

  it('chains verify after record when status is Verified (unchanged behaviour)', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 7, onSuccess }))
    result.current.handleRecordPayment(baseInput({ status: 'Verified' }))

    // Simulate the record mutation succeeding to trigger the verify chain.
    const [, options] = mocks.recordMutate.mock.calls[0]
    options.onSuccess({ payment_number: 'P-1', id: 1 })

    expect(mocks.verifyMutate).toHaveBeenCalledTimes(1)
    expect(mocks.verifyMutate.mock.calls[0][0]).toEqual({ paymentId: 'P-1', request: {} })
  })
})
