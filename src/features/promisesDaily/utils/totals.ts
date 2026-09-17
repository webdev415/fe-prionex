/**
 * The one client-side summation of the report: the per-day «Разом» column.
 *
 * Everything else arrives computed (per-department totals and the grand total
 * are the server's exact-Decimal sums), but the contract carries no per-day
 * total — so the day column is summed here, across the departments' aligned
 * series.
 */

import type { PromisesDailyDepartment } from '../types'

/**
 * Sum the departments' series index-by-index into one number per day of the
 * axis. A department whose series is short for an index contributes 0 for it
 * (defensive — the contract aligns `values` with `dates`); a NON-NUMERIC value
 * poisons its day to NaN on purpose, which the shared formatter renders as "—"
 * instead of a silently wrong sum.
 */
export function sumDepartmentsByDay(
  departments: PromisesDailyDepartment[],
  dayCount: number
): number[] {
  return Array.from({ length: dayCount }, (_, day) =>
    departments.reduce((sum, department) => {
      const value = department.values[day]
      if (value === undefined) return sum
      return sum + Number(value)
    }, 0)
  )
}
