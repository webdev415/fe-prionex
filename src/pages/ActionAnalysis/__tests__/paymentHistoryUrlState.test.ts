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

  it('omits default period / sort from the URL', () => {
    const params = writePaymentHistoryUrlState(
      new URLSearchParams(),
      PAYMENT_HISTORY_FILTERS_DEFAULT
    )
    expect(params.get('period')).toBeNull()
    expect(params.get('sort')).toBeNull()
    // date_field was removed in favour of independent verified_at / payment_date ranges
    expect(params.get('date_field')).toBeNull()
    expect(params.get('verified_from')).toBeNull()
    expect(params.get('verified_to')).toBeNull()
    expect(params.get('payment_from')).toBeNull()
    expect(params.get('payment_to')).toBeNull()
  })

  it('round-trips a fully populated state', () => {
    const state: PaymentHistoryBarState = {
      period: 'custom',
      customFromDate: '2026-05-01',
      customToDate: '2026-05-15',
      verifiedFromDate: '2026-05-02',
      verifiedToDate: '2026-05-10',
      paymentFromDate: '2026-05-03',
      paymentToDate: '2026-05-12',
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

  it('round-trips the four independent date keys under their own URL names', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      verifiedFromDate: '2026-05-02',
      verifiedToDate: '2026-05-10',
      paymentFromDate: '2026-05-03',
      paymentToDate: '2026-05-12',
    }
    const params = writePaymentHistoryUrlState(new URLSearchParams(), state)
    expect(params.get('verified_from')).toBe('2026-05-02')
    expect(params.get('verified_to')).toBe('2026-05-10')
    expect(params.get('payment_from')).toBe('2026-05-03')
    expect(params.get('payment_to')).toBe('2026-05-12')
  })

  it('drops malformed YMD dates silently when reading', () => {
    const params = new URLSearchParams()
    params.set('verified_from', '2026/05/02') // wrong format
    params.set('payment_to', '12-05-2026') // wrong format
    const out = readPaymentHistoryUrlState(params)
    expect(out.verifiedFromDate).toBeUndefined()
    expect(out.paymentToDate).toBeUndefined()
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

  it('drops payment_type values outside the controlled vocab (post KAN-507 split)', () => {
    // Pre-split deep-links may carry free-text values; after the split the
    // column is controlled vocab — anything else is silently discarded.
    const params = new URLSearchParams()
    params.append('payment_type', 'основной долг')
    params.append('payment_type', 'payment_by_rr')
    const out = readPaymentHistoryUrlState(params)
    expect(out.paymentTypes).toEqual(['payment_by_rr'])
  })

  it('round-trips paymentCommentSearch under payment_comment_search', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      paymentCommentSearch: 'проценты',
    }
    const params = writePaymentHistoryUrlState(new URLSearchParams(), state)
    expect(params.get('payment_comment_search')).toBe('проценты')
    expect(roundtrip(state)).toEqual(state)
  })

  it('trims whitespace-only paymentCommentSearch to undefined', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      paymentCommentSearch: '   ',
    }
    const params = writePaymentHistoryUrlState(new URLSearchParams(), state)
    expect(params.get('payment_comment_search')).toBeNull()
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

  it('emits verified_at_from/to as ISO datetimes (start-of-day → end-of-day local)', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      verifiedFromDate: '2026-05-02',
      verifiedToDate: '2026-05-10',
    }
    const q = toPaymentMonitoringQuery(state, undefined)
    // Range bounds are timezone-dependent ISO strings (built from local-time
    // start/end-of-day), so we only assert the relationship and the implied
    // window length (>= ~7 days × 24h, with some tz slop tolerated).
    expect(q.verified_at_from).toBeDefined()
    expect(q.verified_at_to).toBeDefined()
    const span = new Date(q.verified_at_to!).getTime() - new Date(q.verified_at_from!).getTime()
    expect(span).toBeGreaterThan(7 * 24 * 60 * 60 * 1000)
  })

  it('emits payment_date_from/to as YYYY-MM-DD strings (DATE column)', () => {
    const state: PaymentHistoryBarState = {
      ...PAYMENT_HISTORY_FILTERS_DEFAULT,
      paymentFromDate: '2026-05-03',
      paymentToDate: '2026-05-12',
    }
    const q = toPaymentMonitoringQuery(state, undefined)
    expect(q.payment_date_from).toBe('2026-05-03')
    expect(q.payment_date_to).toBe('2026-05-12')
  })

  it('omits the new date params when not set', () => {
    const q = toPaymentMonitoringQuery(PAYMENT_HISTORY_FILTERS_DEFAULT, undefined)
    expect(q.verified_at_from).toBeUndefined()
    expect(q.verified_at_to).toBeUndefined()
    expect(q.payment_date_from).toBeUndefined()
    expect(q.payment_date_to).toBeUndefined()
  })
})
