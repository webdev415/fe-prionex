/**
 * RR payment-schedule generation (KAN-785 Part 1 — Payment Periodicity).
 *
 * Pure, timezone-safe date math used by the RR creation form to auto-fill the
 * payment schedule from a chosen frequency. All arithmetic uses the Date's
 * local Y/M/D components (never UTC) so it matches the dd-MM-yyyy values the
 * operator sees in their profile timezone and never drifts by a day.
 *
 * Keep the type keys in sync with the backend:
 * api-prionex/services/client/app/models/rr_periodicity_settings.py
 */

export const PERIODICITY_EVERY_N_DAYS = 'every_n_days'
export const PERIODICITY_MONTHLY_SAME_DAY = 'monthly_same_day'
export const PERIODICITY_MONTHLY_NTH_DAY = 'monthly_nth_day'

export const CANONICAL_PERIODICITY_TYPES = [
  PERIODICITY_EVERY_N_DAYS,
  PERIODICITY_MONTHLY_SAME_DAY,
  PERIODICITY_MONTHLY_NTH_DAY,
] as const

export type PeriodicityType = (typeof CANONICAL_PERIODICITY_TYPES)[number]

/** A single row in the editable RR schedule. */
export interface ScheduleRow {
  date: Date | null
  amount: string
}

export interface GenerateScheduleParams {
  /** Operator-chosen first payment date; the anchor for row 0. */
  firstDate: Date | null
  /** Number of payments (schedule length). Clamped to [1, 12] by the caller. */
  numPayments: number
  frequency: PeriodicityType
  /** Interval for {@link PERIODICITY_EVERY_N_DAYS} (e.g. 14). */
  intervalDays?: number
  /**
   * Day-of-month for {@link PERIODICITY_MONTHLY_NTH_DAY}: 1-30, or the string
   * 'last' for the last calendar day of each month.
   */
  dayOfMonth?: number | 'last'
  /** Total restructuring amount to split evenly across the payments. */
  totalAmount?: number | null
}

export interface GenerateScheduleResult {
  rows: ScheduleRow[]
  /**
   * 0-based indexes of rows whose day-of-month did not exist in the target
   * month and was clamped to the last day (e.g. the 31st -> 28 Feb). The form
   * surfaces these so the operator knows a date was adjusted.
   */
  clampedIndexes: number[]
}

/** Number of days in the given month (monthIndex is 0-based, as in Date). */
export function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Add `n` days to a date using local components (no UTC / DST drift). */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)
}

/**
 * The date `monthsToAdd` months after `base`, on `desiredDay` of that month,
 * clamped to the month's last day when `desiredDay` overflows.
 */
function dateInMonth(
  base: Date,
  monthsToAdd: number,
  desiredDay: number | 'last'
): { date: Date; clamped: boolean } {
  // Normalise the target month/year (JS Date handles month overflow).
  const target = new Date(base.getFullYear(), base.getMonth() + monthsToAdd, 1)
  const year = target.getFullYear()
  const monthIndex = target.getMonth()
  const maxDay = daysInMonth(year, monthIndex)

  if (desiredDay === 'last') {
    return { date: new Date(year, monthIndex, maxDay), clamped: false }
  }
  const clamped = desiredDay > maxDay
  const day = clamped ? maxDay : desiredDay
  return { date: new Date(year, monthIndex, day), clamped }
}

/** Even split of `total` (2dp) across `count` rows; remainder on the last row. */
function splitAmount(total: number, count: number): string[] {
  if (!Number.isFinite(total) || total <= 0 || count <= 0) {
    return Array.from({ length: Math.max(0, count) }, () => '')
  }
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => {
    const cents = i === count - 1 ? base + remainder : base
    return (cents / 100).toFixed(2)
  })
}

/**
 * Generate the full payment schedule from the anchor (row 0) date, the
 * frequency, and the number of payments. Row 0 always keeps `firstDate`; the
 * frequency governs rows 1..n-1. Amounts are the even split of `totalAmount`
 * (empty strings when no valid total is given).
 *
 * Editing an individual date afterwards is the caller's concern — this function
 * only (re)generates the whole schedule from scratch (no cascade).
 */
export function generateSchedule(params: GenerateScheduleParams): GenerateScheduleResult {
  const { firstDate, frequency, intervalDays, dayOfMonth, totalAmount } = params
  const count = Math.max(0, Math.floor(params.numPayments || 0))
  const amounts = splitAmount(Number(totalAmount ?? 0), count)
  const clampedIndexes: number[] = []

  const rows: ScheduleRow[] = []
  for (let i = 0; i < count; i++) {
    let date: Date | null = firstDate

    if (firstDate && i > 0) {
      if (frequency === PERIODICITY_EVERY_N_DAYS) {
        const step = Math.max(1, Math.floor(intervalDays || 0))
        date = addDays(firstDate, step * i)
      } else if (frequency === PERIODICITY_MONTHLY_SAME_DAY) {
        const res = dateInMonth(firstDate, i, firstDate.getDate())
        date = res.date
        if (res.clamped) clampedIndexes.push(i)
      } else if (frequency === PERIODICITY_MONTHLY_NTH_DAY) {
        const desired = dayOfMonth ?? firstDate.getDate()
        const res = dateInMonth(firstDate, i, desired)
        date = res.date
        if (res.clamped) clampedIndexes.push(i)
      }
    }

    rows.push({ date, amount: amounts[i] ?? '' })
  }

  return { rows, clampedIndexes }
}

/** Whether the given frequency needs an extra numeric parameter from the UI. */
export function periodicityNeedsParam(frequency: PeriodicityType | ''): boolean {
  return frequency === PERIODICITY_EVERY_N_DAYS || frequency === PERIODICITY_MONTHLY_NTH_DAY
}
