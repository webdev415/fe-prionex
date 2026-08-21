/**
 * Principal Debt tooltip text (KAN-994).
 *
 * The tooltip is the coefficient line and nothing else, per "Tooltip format —
 * Single line". When no coefficient applies the caller shows no tooltip at all,
 * per the AC for an empty Principal debt or an age matching no configured
 * range — so this returns null rather than falling back to prose.
 *
 * Kept out of LoanCard so the formatting rules — the multiplication sign, the
 * en-dash between coefficients, and the space-separated whole amounts the
 * requirement specifies — are testable without hovering a Radix tooltip.
 */

export interface ClosingCoefficient {
  min_coefficient: string
  max_coefficient: string
  min_amount: string
  max_amount: string
  debt_age_days: number
}

type Translate = (key: string, fallback: string) => string

/** Thousands separated by a NO-BREAK space, per the requirement's "5 051".
 *  A plain space would let a number wrap mid-value, the same problem KAN-993
 *  fixed on the card itself. */
export function groupThousands(amount: string): string {
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
}

/** The coefficient line, or null when there is no tooltip to show. */
export function buildPrincipalDebtTooltip(
  coefficient: ClosingCoefficient | null | undefined,
  t: Translate
): string | null {
  // The backend returns null whenever the requirement says no coefficient
  // tooltip is due (no principal debt, no matching age range, no purchase
  // date), so eligibility is not re-decided here.
  if (!coefficient) return null

  const label = t('pages.clients.detail.closingCoefficientLabel', 'Loan closing coefficient')
  const line =
    `${label}: ×${coefficient.min_coefficient}–${coefficient.max_coefficient}: ` +
    `\u20B4\u00A0${groupThousands(coefficient.min_amount)} – ${groupThousands(coefficient.max_amount)}`
  return line
}
