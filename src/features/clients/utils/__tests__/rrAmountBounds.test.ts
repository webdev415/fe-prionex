import { describe, expect, it } from 'vitest'

import { RR_AMOUNT_FLOOR, checkRrAmount, rrAmountBounds } from '../rrAmountBounds'

/**
 * The cases mirror the API's own suite
 * (api-prionex/services/client/tests/test_rr_amount_bounds.py) so the two
 * sides cannot drift apart silently: the form must refuse what the API
 * refuses, and -- just as importantly -- must not refuse what it accepts.
 *
 * Money arrives as server-formatted strings, so the fixtures use strings.
 */
const loan = (principal_debt: string | null, total_to_return: string | null) => ({
  principal_debt,
  total_to_return,
})

describe('rrAmountBounds', () => {
  it('runs from the principal up to what is left to return', () => {
    expect(rrAmountBounds(loan('1000.00', '5000.00'))).toEqual({
      verdict: 'ok',
      lower: 1000,
      upper: 5000,
    })
  })

  it('floors a legacy loan with no principal at a kopeck', () => {
    // principal_debt is "-" for a legacy credit without issued_amount, which
    // is not a rare shape: 173,315 of 406,890 active project-1 loans.
    expect(rrAmountBounds(loan(null, '5000.00'))).toEqual({
      verdict: 'ok',
      lower: RR_AMOUNT_FLOOR,
      upper: 5000,
    })
  })

  it('floors a negative principal rather than opening the range below zero', () => {
    // Overpayment or a duplicate write-off can drive it below zero.
    expect(rrAmountBounds(loan('-250.00', '5000.00'))).toEqual({
      verdict: 'ok',
      lower: RR_AMOUNT_FLOOR,
      upper: 5000,
    })
  })

  it('collapses to a single point when the principal exceeds the ceiling', () => {
    // Payments went against interest, leaving the principal above what is
    // left to return. Exactly one total is then valid.
    expect(rrAmountBounds(loan('5000.00', '3000.00'))).toEqual({
      verdict: 'ok',
      lower: 3000,
      upper: 3000,
    })
  })

  it('reports a credit with nothing left to return', () => {
    expect(rrAmountBounds(loan('1000.00', '-500.00'))).toEqual({
      verdict: 'nothing-left',
      upper: -500,
    })
  })

  it('treats an exactly-zero ceiling as nothing left, not as a valid range', () => {
    expect(rrAmountBounds(loan('1000.00', '0.00'))).toEqual({
      verdict: 'nothing-left',
      upper: 0,
    })
  })

  it('defers to the API when the ceiling is missing', () => {
    // Blocking here would refuse a save the API would have allowed.
    expect(rrAmountBounds(loan('1000.00', null))).toEqual({ verdict: 'unknown' })
    expect(rrAmountBounds(undefined)).toEqual({ verdict: 'unknown' })
  })
})

describe('checkRrAmount', () => {
  const standard = loan('1000.00', '5000.00')

  it('accepts a total inside the range', () => {
    expect(checkRrAmount(2000, standard).verdict).toBe('ok')
  })

  it('accepts the bounds themselves', () => {
    expect(checkRrAmount(1000, standard).verdict).toBe('ok')
    expect(checkRrAmount(5000, standard).verdict).toBe('ok')
  })

  it('refuses a total below the principal', () => {
    // The reason the ticket exists: closing a credit for less than its
    // principal, by inattention rather than by decision.
    expect(checkRrAmount(999.99, standard)).toEqual({
      verdict: 'out-of-range',
      lower: 1000,
      upper: 5000,
    })
  })

  it('refuses a total above what is left to return', () => {
    expect(checkRrAmount(5000.01, standard)).toEqual({
      verdict: 'out-of-range',
      lower: 1000,
      upper: 5000,
    })
  })

  it('does not reject a boundary total over float representation', () => {
    // 0.1 + 0.2 arithmetic upstream must not cost the operator a valid save;
    // both sides round to two places before comparing.
    expect(checkRrAmount(1000.0000000000002, standard).verdict).toBe('ok')
    expect(checkRrAmount(4999.999999999999, standard).verdict).toBe('ok')
  })

  it('passes the nothing-left verdict through', () => {
    expect(checkRrAmount(400, loan('1000.00', '-500.00'))).toEqual({
      verdict: 'nothing-left',
      upper: -500,
    })
  })

  it('leaves a blank total to the existing required-field check', () => {
    // Reporting it here too would replace "amount is required" with a range.
    expect(checkRrAmount(null, standard)).toEqual({ verdict: 'unknown' })
    expect(checkRrAmount(Number.NaN, standard)).toEqual({ verdict: 'unknown' })
  })

  it('accepts a kopeck on a legacy loan with no principal', () => {
    expect(checkRrAmount(0.01, loan(null, '5000.00')).verdict).toBe('ok')
  })
})
