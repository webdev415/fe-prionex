import { describe, expect, it } from 'vitest'

import {
  addDays,
  daysInMonth,
  generateSchedule,
  PERIODICITY_EVERY_N_DAYS,
  PERIODICITY_MONTHLY_NTH_DAY,
  PERIODICITY_MONTHLY_SAME_DAY,
  periodicityNeedsParam,
} from '../rrSchedule'

// Local YMD helper — avoids UTC parsing that `new Date('2026-01-31')` would do.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)
const ymd = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`
    : null

describe('daysInMonth', () => {
  it('handles Feb in common and leap years', () => {
    expect(daysInMonth(2026, 1)).toBe(28) // Feb 2026
    expect(daysInMonth(2028, 1)).toBe(29) // Feb 2028 (leap)
    expect(daysInMonth(2026, 3)).toBe(30) // Apr
  })
})

describe('addDays', () => {
  it('rolls across month/year boundaries', () => {
    expect(ymd(addDays(d(2026, 1, 31), 1))).toBe('2026-02-01')
    expect(ymd(addDays(d(2026, 12, 31), 1))).toBe('2027-01-01')
  })
})

describe('generateSchedule — every N days', () => {
  it('steps by the interval, row 0 stays the anchor', () => {
    const { rows, clampedIndexes } = generateSchedule({
      firstDate: d(2026, 7, 10),
      numPayments: 4,
      frequency: PERIODICITY_EVERY_N_DAYS,
      intervalDays: 14,
      totalAmount: 400,
    })
    expect(rows.map((r) => ymd(r.date))).toEqual([
      '2026-07-10',
      '2026-07-24',
      '2026-08-07',
      '2026-08-21',
    ])
    expect(clampedIndexes).toEqual([])
  })
})

describe('generateSchedule — monthly same day', () => {
  it('keeps the anchor day-of-month each month', () => {
    const { rows } = generateSchedule({
      firstDate: d(2026, 1, 15),
      numPayments: 3,
      frequency: PERIODICITY_MONTHLY_SAME_DAY,
    })
    expect(rows.map((r) => ymd(r.date))).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('clamps the 31st to the last day of short months and flags it', () => {
    const { rows, clampedIndexes } = generateSchedule({
      firstDate: d(2026, 1, 31),
      numPayments: 4,
      frequency: PERIODICITY_MONTHLY_SAME_DAY,
    })
    expect(rows.map((r) => ymd(r.date))).toEqual([
      '2026-01-31',
      '2026-02-28', // clamped
      '2026-03-31',
      '2026-04-30', // clamped
    ])
    expect(clampedIndexes).toEqual([1, 3])
  })
})

describe('generateSchedule — every Nth of month', () => {
  it('places rows 1..n on the chosen day, row 0 is the anchor', () => {
    const { rows } = generateSchedule({
      firstDate: d(2026, 7, 20),
      numPayments: 3,
      frequency: PERIODICITY_MONTHLY_NTH_DAY,
      dayOfMonth: 5,
    })
    expect(rows.map((r) => ymd(r.date))).toEqual(['2026-07-20', '2026-08-05', '2026-09-05'])
  })

  it("supports 'last' day of month", () => {
    const { rows, clampedIndexes } = generateSchedule({
      firstDate: d(2026, 1, 10),
      numPayments: 3,
      frequency: PERIODICITY_MONTHLY_NTH_DAY,
      dayOfMonth: 'last',
    })
    expect(rows.map((r) => ymd(r.date))).toEqual(['2026-01-10', '2026-02-28', '2026-03-31'])
    // 'last' is intentional, not a clamp of an impossible date.
    expect(clampedIndexes).toEqual([])
  })

  it('clamps a chosen 31st in a 30-day month', () => {
    const { clampedIndexes, rows } = generateSchedule({
      firstDate: d(2026, 3, 31),
      numPayments: 2,
      frequency: PERIODICITY_MONTHLY_NTH_DAY,
      dayOfMonth: 31,
    })
    expect(ymd(rows[1].date)).toBe('2026-04-30')
    expect(clampedIndexes).toEqual([1])
  })
})

describe('generateSchedule — amount split', () => {
  it('splits evenly with the remainder on the last row', () => {
    const { rows } = generateSchedule({
      firstDate: d(2026, 7, 10),
      numPayments: 3,
      frequency: PERIODICITY_EVERY_N_DAYS,
      intervalDays: 30,
      totalAmount: 100,
    })
    expect(rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.34'])
    const sum = rows.reduce((s, r) => s + parseFloat(r.amount), 0)
    expect(sum).toBeCloseTo(100, 2)
  })

  it('leaves amounts blank when no valid total is given', () => {
    const { rows } = generateSchedule({
      firstDate: d(2026, 7, 10),
      numPayments: 2,
      frequency: PERIODICITY_EVERY_N_DAYS,
      intervalDays: 30,
      totalAmount: 0,
    })
    expect(rows.map((r) => r.amount)).toEqual(['', ''])
  })
})

describe('periodicityNeedsParam', () => {
  it('is true only for the parameterised frequencies', () => {
    expect(periodicityNeedsParam(PERIODICITY_EVERY_N_DAYS)).toBe(true)
    expect(periodicityNeedsParam(PERIODICITY_MONTHLY_NTH_DAY)).toBe(true)
    expect(periodicityNeedsParam(PERIODICITY_MONTHLY_SAME_DAY)).toBe(false)
    expect(periodicityNeedsParam('')).toBe(false)
  })
})
