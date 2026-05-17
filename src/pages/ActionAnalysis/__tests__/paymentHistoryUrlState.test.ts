import { describe, expect, it } from 'vitest'
import {
  PAYMENT_HISTORY_FILTERS_DEFAULT,
  readPaymentHistoryUrlState,
  toPaymentMonitoringQuery,
  writePaymentHistoryUrlState,
  type PaymentHistoryBarState,
} from '../lib/paymentHistoryUrlState'

function roundtrip(state: PaymentHistoryBarState): PaymentHistoryBarState {
  const params = writePaymentHistoryUrlState(new URLSearchParams(), state)
  return readPaymentHistoryUrlState(params)
}

describe('paymentHistoryUrlState', () => {
  it('defaults round-trip cleanly', () => {
    const out = roundtrip(PAYMENT_HISTORY_FILTERS_DEFAULT)
    expect(out).toEqual(PAYMENT_HISTORY_FILTERS_DEFAULT)
  })

  it('omits default period / sort / date_field from the URL', () => {
    const params = writePaymentHistoryUrlState(
      new URLSearchParams(),
      PAYMENT_HISTORY_FILTERS_DEFAULT
    )
    expect(params.get('period')).toBeNull()
    expect(params.get('sort')).toBeNull()
    expect(params.get('date_field')).toBeNull()
  })

  it('round-trips a fully populated state', () => {
    const state: PaymentHistoryBarState = {
      period: 'custom',
      customFromDate: '2026-05-01',
      customToDate: '2026-05-15',
      dateField: 'verified_at',
      employeeIds: [12, 34],
      paymentMethods: ['card', 'cash'],
      statuses: ['verified', 'pending'],
      paymentTypes: ['payment_by_rr', 'full_payment'],
      amountMin: 100,
      amountMax: 5000,
      sort: 'amount_desc',
    }
    expect(roundtrip(state)).toEqual(state)
  })

  it('serialises multi-select filters as repeated query keys', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      paymentMethods: ['card', 'bank_transfer'],
      statuses: ['pending'],
      paymentTypes: ['partial_payment'],
      employeeIds: [7],
    }
    const params = writePaymentHistoryUrlState(new URLSearchParams(), state)
    expect(params.getAll('payment_method')).toEqual(['card', 'bank_transfer'])
    expect(params.getAll('status')).toEqual(['pending'])
    expect(params.getAll('payment_type')).toEqual(['partial_payment'])
    expect(params.getAll('employee_id')).toEqual(['7'])
  })

  it('drops unknown payment_method / status values when reading', () => {
    const params = new URLSearchParams()
    params.append('payment_method', 'crypto')
    params.append('payment_method', 'card')
    params.append('status', 'approved')
    params.append('status', 'verified')
    const out = readPaymentHistoryUrlState(params)
    expect(out.paymentMethods).toEqual(['card'])
    expect(out.statuses).toEqual(['verified'])
  })

  it('preserves arbitrary payment_type strings (legacy free-text rows)', () => {
    // Legacy rows pre-KAN-507 hold free text; the deep-link URL must round-trip
    // even values not in the controlled vocabulary.
    const params = new URLSearchParams()
    params.append('payment_type', 'основной долг')
    params.append('payment_type', 'payment_by_rr')
    const out = readPaymentHistoryUrlState(params)
    expect(out.paymentTypes).toEqual(['основной долг', 'payment_by_rr'])
  })

  it('drops unknown sort silently and falls back to default', () => {
    const params = new URLSearchParams()
    params.set('sort', 'banana_desc')
    const out = readPaymentHistoryUrlState(params)
    expect(out.sort).toBe('recorded_at_desc')
  })
})

describe('toPaymentMonitoringQuery — scope composition', () => {
  it('passes employee refinement through when scope is undefined (scope=all)', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      employeeIds: [10, 20],
    }
    const q = toPaymentMonitoringQuery(state, undefined)
    expect(q.user_ids).toEqual([10, 20])
  })

  it('uses the scope alone when no employee refinement is set', () => {
    const q = toPaymentMonitoringQuery(PAYMENT_HISTORY_FILTERS_DEFAULT, [1, 2, 3])
    expect(q.user_ids).toEqual([1, 2, 3])
  })

  it('intersects employee refinement with the scope', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      employeeIds: [10, 20, 30],
    }
    const q = toPaymentMonitoringQuery(state, [20, 30, 40])
    expect(q.user_ids).toEqual([20, 30])
  })

  it('returns an empty user_ids when the intersection is empty (scope > 0 but no overlap)', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      employeeIds: [10],
    }
    const q = toPaymentMonitoringQuery(state, [99])
    expect(q.user_ids).toEqual([])
  })
})
