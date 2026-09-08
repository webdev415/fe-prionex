/**
 * Value formatting shared by the report's matrix cells and its totals, so a
 * total can never be rendered by a different rule than the cells above it.
 */

import { formatMoneyAmount } from '@/lib/localeFormat'

/** Placeholder for a value the report has no answer for (shared table convention). */
export const EMPTY = '—'

/**
 * A money cell: locale grouping, two decimals — the shared money formatter, so
 * a hryvnia in this report is rendered by the same rule as everywhere else.
 * A missing or non-finite value renders "—" rather than "NaN" (`formatNumber`
 * owns that guard, one layer below). Money is exact `Decimal` server-side and
 * arrives as strings ("112062.00").
 */
export function formatMoney(value: string | number | null | undefined, language: string): string {
  return formatMoneyAmount(value, language)
}
