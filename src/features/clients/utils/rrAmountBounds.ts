/**
 * RR total-amount bounds (KAN-1122).
 *
 * An operator could previously save any restructuring total. Restructure a
 * credit for less than its principal and the closure machinery later closes it
 * at that figure -- money written off by inattention rather than by decision.
 *
 *     upper = total_to_return
 *     lower = max(0.01, min(principal_debt ?? 0.01, total_to_return))
 *
 * Both figures are read from the loan row as the server computed them, NOT
 * recomputed here: they are the same numbers the card shows in its "Principal
 * Debt" and "Including payments" columns, so the operator is judged against
 * what they were shown. The formula has drifted between call sites before
 * (KAN-998, KAN-1057), which is why neither side reimplements it.
 *
 * This check is advisory -- it catches the mistake in the form, where it can
 * be explained. The authority is the API, which applies the same rule:
 * api-prionex/services/client/app/routers/clients.py
 * (``create_restructuring_agreement``). Keep the two in sync.
 */

/** Smallest restructurable total. The range never opens at zero. */
export const RR_AMOUNT_FLOOR = 0.01

/** A loan row, narrowed to the two fields the bounds are read from. */
export interface RrBoundsLoan {
  principal_debt?: string | number | null
  total_to_return?: string | number | null
}

export type RrAmountCheck =
  /** Bounds could not be established; defer to the API rather than block. */
  | { verdict: 'unknown' }
  /** Nothing is left to return, so no total could ever be valid. */
  | { verdict: 'nothing-left'; upper: number }
  | { verdict: 'out-of-range'; lower: number; upper: number }
  | { verdict: 'ok'; lower: number; upper: number }

/** Money arrives as a server-formatted string ("5000.00"), or occasionally a
 *  number. Anything unparseable is treated as absent, never as 0: a silent 0
 *  here would invent a bound rather than admit it is unknown. */
function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Mirrors the backend's ``quantize(TWO_PLACES)``. Comparing raw floats at a
 *  boundary would let the form reject a total the API accepts. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** The range a restructuring total must fall inside for this loan. */
export function rrAmountBounds(
  loan: RrBoundsLoan | null | undefined
): RrAmountCheck & { verdict: 'unknown' | 'nothing-left' | 'ok' } {
  const totalToReturn = toAmount(loan?.total_to_return)
  if (totalToReturn === null) return { verdict: 'unknown' }

  const upper = round2(totalToReturn)
  if (upper < RR_AMOUNT_FLOOR) return { verdict: 'nothing-left', upper }

  // An absent principal ("-" on a legacy loan with no issued_amount) and a
  // negative one (overpayment, duplicate write-off) both land on the floor
  // rather than on 0 or below it.
  const principalDebt = toAmount(loan?.principal_debt)
  const lower = round2(Math.max(RR_AMOUNT_FLOOR, Math.min(principalDebt ?? RR_AMOUNT_FLOOR, upper)))
  return { verdict: 'ok', lower, upper }
}

/**
 * Judge a typed total against its loan's bounds.
 *
 * A total that is blank or unparseable returns 'unknown': the form's existing
 * "amount is required" check owns that case, and reporting it twice would
 * replace a clear message with a confusing one.
 */
export function checkRrAmount(
  amount: number | null | undefined,
  loan: RrBoundsLoan | null | undefined
): RrAmountCheck {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return { verdict: 'unknown' }
  }

  const bounds = rrAmountBounds(loan)
  if (bounds.verdict !== 'ok') return bounds

  const typed = round2(amount)
  if (typed < bounds.lower || typed > bounds.upper) {
    return { verdict: 'out-of-range', lower: bounds.lower, upper: bounds.upper }
  }
  return { verdict: 'ok', lower: bounds.lower, upper: bounds.upper }
}
