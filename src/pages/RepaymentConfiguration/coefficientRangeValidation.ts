/**
 * Client-side validation for a coefficient range.
 *
 * Mirrors the server rules so the user is told before a round trip; the server
 * remains the authority (the overlap rule in particular is a database
 * constraint and cannot be checked here at all).
 *
 * Extracted from CoefficientRangesSection so the rules are testable directly —
 * reaching them through the component would mean rendering a modal, filling
 * inputs and asserting on a toast, which tests the plumbing rather than the
 * rules.
 */

export interface RangeFormState {
  min_days: string
  max_days: string
  min_coefficient: string
  max_coefficient: string
}

type Translate = (key: string, fallback: string) => string

/** One decimal place, 1.0–10.0. Mirrors the server rule so the user is told
 *  before a round trip; the server remains the authority. */
const COEFFICIENT_PATTERN = /^\d+(\.\d)?$/

/** Digits only. Tested against the raw string because Number() accepts things
 *  a day count is not: "" and "   " both coerce to 0, so an empty form would
 *  save as the range 0-0 with no error, and "1e3"/"0x10" coerce to 1000/16.
 *  Number.isInteger() is true for all of them, so the check has to happen
 *  before coercion. */
export const DAYS_PATTERN = /^\d+$/

export function validateRange(form: RangeFormState, t: Translate): string | null {
  const minRaw = form.min_days.trim()
  const maxRaw = form.max_days.trim()

  if (!DAYS_PATTERN.test(minRaw) || !DAYS_PATTERN.test(maxRaw)) {
    return t('pages.coefficientRanges.errors.days', 'Days must be whole numbers of 0 or more')
  }
  const minDays = Number(minRaw)
  const maxDays = Number(maxRaw)
  if (minDays > maxDays) {
    return t('pages.coefficientRanges.errors.dayOrder', 'Min days must not exceed max days')
  }
  for (const key of ['min_coefficient', 'max_coefficient'] as const) {
    const raw = form[key]
    if (!COEFFICIENT_PATTERN.test(raw)) {
      return t(
        'pages.coefficientRanges.errors.coefficientFormat',
        'Coefficients allow at most one decimal place (e.g. 1.5)'
      )
    }
    const value = Number(raw)
    if (value < 1 || value > 10) {
      return t('pages.coefficientRanges.errors.coefficientRange', 'Coefficients must be 1.0–10.0')
    }
  }
  if (Number(form.min_coefficient) > Number(form.max_coefficient)) {
    return t(
      'pages.coefficientRanges.errors.coefficientOrder',
      'Min coefficient must not exceed max coefficient'
    )
  }
  return null
}
