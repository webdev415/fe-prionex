/**
 * Client-side totals over the rows a department sub-tab actually shows.
 *
 * The backend's `totals` block covers EVERY row of the response — every
 * department and every dismissed operator — and is deliberately not a
 * per-department subtotal (docs/operator-promises-report.md: "the frontend
 * groups rows into its department tabs and recomputes its own subtotals from
 * them, exactly as Techno-Finance does"). This module is that recomputation.
 *
 * Two rules are copied from the server so the two blocks cannot disagree, and
 * they apply to BOTH payment sides — the full one and the verified one:
 * - `conversion` / `verified_conversion` are RECOMPUTED as `Σ paid / Σ sum_to`,
 *   never averaged — a ratio cannot be summed — and are null when the visible
 *   rows had nothing due;
 * - `unpaid` / `verified_unpaid` are summed from the rows rather than derived,
 *   so they stay exactly `Σ sum_to − Σ paid` even if a single row ever
 *   disagreed.
 *
 * Money arrives as exact `Decimal` STRINGS and is summed here as IEEE doubles.
 * That is safe at this scale and not a silent approximation: the widest
 * production figure is ≈ 3.5 × 10⁷ with four decimals (11 significant digits)
 * over ~136 rows, which leaves a double's 15–16 significant digits ~4 orders of
 * magnitude of headroom — the accumulated error is far below the hundredth of a
 * hryvnia the table renders. Anything that needs cent-exactness (an export, a
 * reconciliation) must read the server's own totals, which are Decimal end to
 * end.
 *
 * A non-numeric or missing money value contributes 0 rather than turning the
 * whole block into "NaN": one malformed cell must not take the totals down.
 */

import type { OperatorPromisesRow, OperatorPromisesTotals } from '../api/types'

/** Numeric value of a Decimal-as-string field; 0 for anything non-finite. */
function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0
}

/**
 * Sum `rows` into the same shape the backend's `totals` block uses, so both can
 * be rendered by one component.
 *
 * `operators` is the number of rows — one row is one operator by contract
 * (rows are keyed by `user_id`, which is why namesakes are two rows here and
 * one in the card).
 */
export function sumOperatorPromisesRows(rows: OperatorPromisesRow[]): OperatorPromisesTotals {
  const totals = rows.reduce(
    (acc, row) => {
      acc.interactions_count += toNumber(row.interactions_count)
      acc.sum_from += toNumber(row.sum_from)
      acc.sum_to += toNumber(row.sum_to)
      acc.paid_full += toNumber(row.paid_full)
      acc.paid_verified += toNumber(row.paid_verified)
      acc.unpaid += toNumber(row.unpaid)
      acc.verified_unpaid += toNumber(row.verified_unpaid)
      return acc
    },
    {
      interactions_count: 0,
      sum_from: 0,
      sum_to: 0,
      paid_full: 0,
      paid_verified: 0,
      unpaid: 0,
      verified_unpaid: 0,
    }
  )

  return {
    operators: rows.length,
    ...totals,
    // Same rule as the server's: null for a zero denominator, not 0 — "nothing
    // was due" is undefined, not "collected nothing". Both conversions are
    // ratios of the SUMS, never means of the per-row ratios.
    conversion: totals.sum_to === 0 ? null : totals.paid_full / totals.sum_to,
    verified_conversion: totals.sum_to === 0 ? null : totals.paid_verified / totals.sum_to,
  }
}
