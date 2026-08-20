/**
 * Value formatting shared by the report's table and its totals block, so a
 * subtotal can never be rendered by a different rule than the row above it.
 */

import { formatMoneyAmount, formatNumber } from '@/lib/localeFormat'

/** Placeholder for a value the report has no answer for (shared table convention). */
export const EMPTY = '—'

/**
 * Two decimals — the shape `formatMoneyAmount` already imposes. Kept here only
 * because `formatConversion` below needs the same options for a number that is
 * NOT money (a percentage), so it cannot go through the money helper.
 */
const TWO_DECIMALS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/**
 * A money column: locale grouping, two decimals — the shared money formatter,
 * so a hryvnia in this report is rendered by the same rule as everywhere else.
 * A missing or non-finite value renders "—" rather than "NaN" (`formatNumber`
 * owns that guard, one layer below).
 *
 * Money is exact `Decimal` server-side — always two decimals, never truncated.
 * `sum_from` can arrive with more (production carries "34508717.5067", and one
 * production promise is literally ".010720262341"); rounding it to the
 * hundredth for display is deliberate, since the column is hryvnias.
 *
 * Negative values are NOT special-cased: `unpaid` is `sum_to − paid_full`, so a
 * negative number means the operator collected MORE than was due, which happens
 * legitimately and often (payments are never matched to the promises they
 * settle — see the contract).
 */
export function formatMoney(value: string | number | null | undefined, language: string): string {
  return formatMoneyAmount(value, language)
}

/** A plain count column (chain runs, operators): locale grouping, no decimals. */
export function formatCount(value: string | number | null | undefined, language: string): string {
  return formatNumber(value, language)
}

/**
 * `conversion` as a percentage.
 *
 * The backend returns a SHARE rounded to six decimals ("1.308333") and states
 * that the frontend multiplies by 100 — so the ×100 lives here, in one place,
 * for both the rows and the totals. Two decimals matches the percent columns of
 * the sibling processing report.
 *
 * A null conversion (`sum_to = 0` — nothing was due, whether or not money
 * arrived) renders "—": it is undefined, not zero, and showing "0,00 %" would
 * read as "this operator collected nothing" for someone who may well have
 * collected plenty. Values above 100 % are normal and are NOT clamped.
 */
export function formatConversion(
  value: string | number | null | undefined,
  language: string
): string {
  const share = typeof value === 'string' ? Number(value) : value
  if (typeof share !== 'number' || !Number.isFinite(share)) return EMPTY
  return `${formatNumber(share * 100, language, TWO_DECIMALS)}%`
}
