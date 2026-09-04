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
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import { toast } from 'sonner'
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

describe('useRecordPaymentFlow — EasyPay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Drive the record mutation's onSuccess with a given save response. */
  function saveAndResolve(
    input: Partial<RecordPaymentInput>,
    payment: Record<string, unknown> = {}
  ) {
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 42 }))
    result.current.handleRecordPayment(baseInput(input))
    const [request, handlers] = mocks.recordMutate.mock.calls[0]
    handlers.onSuccess({ id: 1, payment_number: 'PAY-1', ...payment })
    return request
  }

  it('sends the easypay_method and rides the gateway payment method', () => {
    // EasyPay rides on online_gateway, it is not a payment method of its own.
    const request = saveAndResolve({ method: 'EasyPay', easypayMethod: 'apple_pay' })

    expect(request.easypay_method).toBe('apple_pay')
    expect(request.payment_method).toBe('online_gateway')
  })

  it('sends no easypay_method for an ordinary bank transfer', () => {
    const request = saveAndResolve({ method: 'Bank Transfer' })

    expect(request.easypay_method).toBeUndefined()
    expect(request.payment_method).not.toBe('online_gateway')
  })

  it('copies the link and reports success when the clipboard accepts it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    saveAndResolve(
      { method: 'EasyPay', easypayMethod: 'card', copyLinkAfterSave: true },
      { easypay_link: 'https://easypay.ua/ua/wp2/abc' }
    )
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())

    expect(writeText).toHaveBeenCalledWith('https://easypay.ua/ua/wp2/abc')
    expect(toast.success).toHaveBeenCalledWith('pages.clients.modals.recordPayment.linkCopied')
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('does not claim success when the clipboard write is refused', async () => {
    // Browsers gate clipboard writes on user activation, which expires across
    // the awaited save; a success toast there would be a lie.
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    saveAndResolve(
      { method: 'EasyPay', easypayMethod: 'card', copyLinkAfterSave: true },
      { easypay_link: 'https://easypay.ua/ua/wp2/abc' }
    )
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())

    expect(toast.warning).toHaveBeenCalledWith('pages.clients.modals.recordPayment.linkCopyFailed')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('leaves the clipboard alone when the operator unticks the box', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    saveAndResolve(
      { method: 'EasyPay', easypayMethod: 'card', copyLinkAfterSave: false },
      { easypay_link: 'https://easypay.ua/ua/wp2/abc' }
    )

    // The payment and its link are still created; only the copy is skipped.
    expect(writeText).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('reports a missing link rather than copying nothing', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    // The gateway call sits between creating the payment and storing the URL.
    saveAndResolve({ method: 'EasyPay', easypayMethod: 'card', copyLinkAfterSave: true })

    expect(writeText).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('pages.clients.modals.recordPayment.linkUnavailable')
  })
})

describe('useRecordPaymentFlow — an EasyPay save without an easypay_method', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is still an EasyPay payment, not a manual "other" one', () => {
    // frontendToBackendPaymentMethod falls back to 'other' for unknown names,
    // so keying only on easypay_method would file this as a manual payment and
    // quietly skip the gateway.
    const { result } = renderHook(() => useRecordPaymentFlow({ clientId: 42 }))
    result.current.handleRecordPayment(baseInput({ method: 'EasyPay' }))

    const request = mocks.recordMutate.mock.calls[0][0]
    expect(request.payment_method).toBe('online_gateway')
    expect(request.easypay_method).toBe('card')
  })
})
