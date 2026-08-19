import { describe, expect, it } from 'vitest'
import { sumOperatorPromisesRows } from '../totals'
import type { OperatorPromisesRow } from '../../api/types'

function makeRow(overrides: Partial<OperatorPromisesRow> = {}): OperatorPromisesRow {
  return {
    user_id: 101,
    fio: 'Баженов Олексій Володимирович',
    department: 'Стягнення',
    group_name: 'Група №2',
    is_active: true,
    interactions_count: 0,
    sum_from: '0',
    sum_to: '0',
    paid_full: '0',
    paid_verified: '0',
    unpaid: '0',
    conversion: null,
    verified_unpaid: '0',
    verified_conversion: null,
    ...overrides,
  }
}

describe('sumOperatorPromisesRows', () => {
  it('sums the Decimal-as-string money columns and the counts', () => {
    const totals = sumOperatorPromisesRows([
      makeRow({
        interactions_count: 314,
        sum_from: '112062.00',
        sum_to: '24000.00',
        paid_full: '31400.00',
        paid_verified: '31400.00',
        unpaid: '-7400.00',
      }),
      makeRow({
        user_id: 118,
        interactions_count: 6,
        sum_from: '1000.50',
        sum_to: '76000.00',
        paid_full: '4067.50',
        paid_verified: '0.00',
        unpaid: '71932.50',
      }),
    ])

    expect(totals.operators).toBe(2)
    expect(totals.interactions_count).toBe(320)
    expect(totals.sum_from).toBeCloseTo(113062.5, 6)
    expect(totals.sum_to).toBeCloseTo(100000, 6)
    expect(totals.paid_full).toBeCloseTo(35467.5, 6)
    expect(totals.paid_verified).toBeCloseTo(31400, 6)
  })

  it('sums `verified_unpaid` from the rows, like its full-payment twin', () => {
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: '24000.00', paid_verified: '20000.00', verified_unpaid: '4000.00' }),
      makeRow({
        user_id: 2,
        sum_to: '76000.00',
        paid_verified: '0.00',
        verified_unpaid: '76000.00',
      }),
    ])

    expect(totals.verified_unpaid).toBeCloseTo(80000, 6)
    expect(totals.verified_unpaid).toBeCloseTo(
      (totals.sum_to as number) - (totals.paid_verified as number),
      6
    )
  })

  it('RECOMPUTES verified_conversion as Σpaid_verified / Σsum_to, never averaged', () => {
    // Row verified conversions here are 2.0 and 0.1; their mean is 1.05, while
    // the honest ratio is 2900 / 10000 = 0.29 — the same rule as `conversion`,
    // and the reason a ratio is never summed.
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: '1000.00', paid_verified: '2000.00', verified_conversion: '2' }),
      makeRow({
        user_id: 2,
        sum_to: '9000.00',
        paid_verified: '900.00',
        verified_conversion: '0.1',
      }),
    ])

    expect(totals.verified_conversion).toBeCloseTo(2900 / 10000, 6)
  })

  it('reports a null verified_conversion when nothing was due, even with verified money', () => {
    const totals = sumOperatorPromisesRows([makeRow({ sum_to: '0', paid_verified: '5000.00' })])

    expect(totals.verified_conversion).toBeNull()
    expect(totals.paid_verified).toBeCloseTo(5000, 6)
  })

  it('keeps the two conversions independent of each other', () => {
    // Same denominator, different numerators: averaging or reusing one for the
    // other would collapse them into a single number.
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: '1000.00', paid_full: '800.00', paid_verified: '200.00' }),
    ])

    expect(totals.conversion).toBeCloseTo(0.8, 6)
    expect(totals.verified_conversion).toBeCloseTo(0.2, 6)
  })

  it('sums `unpaid` from the rows rather than deriving it', () => {
    // Keeping it a sum makes the block internally consistent even if a single
    // row ever disagreed with `sum_to − paid_full`.
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: '24000.00', paid_full: '31400.00', unpaid: '-7400.00' }),
      makeRow({ user_id: 2, sum_to: '76000.00', paid_full: '4067.50', unpaid: '71932.50' }),
    ])

    expect(totals.unpaid).toBeCloseTo(64532.5, 6)
    expect(totals.unpaid).toBeCloseTo((totals.sum_to as number) - (totals.paid_full as number), 6)
  })

  it('RECOMPUTES conversion as Σpaid_full / Σsum_to instead of averaging the rows', () => {
    // A ratio cannot be summed, and averaging two rows of wildly different size
    // would misreport the department. Row conversions here are 2.0 and 0.5;
    // their mean is 1.25, the correct answer is 2500/2000 = 1.25 — so the rows
    // are deliberately weighted differently to tell the two apart.
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: '1000.00', paid_full: '2000.00', conversion: '2' }),
      makeRow({ user_id: 2, sum_to: '9000.00', paid_full: '900.00', conversion: '0.1' }),
    ])

    // Mean of the row conversions would be 1.05; the honest ratio is 0.29.
    expect(totals.conversion).toBeCloseTo(2900 / 10000, 6)
  })

  it('reports a null conversion when nothing was due, even if money arrived', () => {
    // Same rule as the server's: "nothing was due" is undefined, not "collected
    // nothing" — an operator can legitimately collect against a zero denominator.
    const totals = sumOperatorPromisesRows([makeRow({ sum_to: '0', paid_full: '5000.00' })])

    expect(totals.conversion).toBeNull()
    expect(totals.paid_full).toBeCloseTo(5000, 6)
  })

  it('produces an all-zero block with a null conversion for no rows', () => {
    expect(sumOperatorPromisesRows([])).toEqual({
      operators: 0,
      interactions_count: 0,
      sum_from: 0,
      sum_to: 0,
      paid_full: 0,
      paid_verified: 0,
      unpaid: 0,
      conversion: null,
      verified_unpaid: 0,
      verified_conversion: null,
    })
  })

  it('counts one row per operator, so namesakes are two', () => {
    // Rows are keyed by user_id server-side precisely because the card's GROUP
    // BY on the concatenated ФИО merges the 6 colliding active accounts.
    const totals = sumOperatorPromisesRows([
      makeRow({ user_id: 1, fio: 'Іваненко Іван Іванович' }),
      makeRow({ user_id: 2, fio: 'Іваненко Іван Іванович' }),
    ])

    expect(totals.operators).toBe(2)
  })

  it('treats a malformed money value as 0 instead of poisoning the block with NaN', () => {
    // One bad cell must not take the whole summary down.
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: 'not-a-number', paid_full: '1000.00' }),
      makeRow({ user_id: 2, sum_to: '2000.00', paid_full: '1000.00' }),
    ])

    expect(totals.sum_to).toBeCloseTo(2000, 6)
    expect(totals.paid_full).toBeCloseTo(2000, 6)
    expect(totals.conversion).toBeCloseTo(1, 6)
  })

  it('accepts money already delivered as numbers, not only as strings', () => {
    const totals = sumOperatorPromisesRows([
      makeRow({ sum_to: 100, paid_full: 250 }),
      makeRow({ user_id: 2, sum_to: 100, paid_full: 50 }),
    ])

    expect(totals.sum_to).toBe(200)
    expect(totals.conversion).toBeCloseTo(1.5, 6)
  })

  it('does not count dismissed operators differently from active ones', () => {
    // `is_active` is display-only and never a filter — the money of someone who
    // worked in the period and left afterwards stays in the period's totals.
    const totals = sumOperatorPromisesRows([
      makeRow({ paid_full: '1000.00', is_active: false }),
      makeRow({ user_id: 2, paid_full: '1000.00', is_active: true }),
    ])

    expect(totals.operators).toBe(2)
    expect(totals.paid_full).toBeCloseTo(2000, 6)
  })
})
