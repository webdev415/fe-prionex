import { describe, expect, it } from 'vitest'
import type { PromisesDailyDepartment } from '../../types'
import { sumDepartmentsByDay } from '../totals'

const department = (
  values: Array<string | number>,
  name: string | null = 'ТП'
): PromisesDailyDepartment => ({ name, values, total: '0.00' })

describe('sumDepartmentsByDay', () => {
  it('sums the departments index-by-index across the whole axis', () => {
    const totals = sumDepartmentsByDay(
      [department(['100.00', '0', '50.50']), department(['200.00', '25.00', '0'], null)],
      3
    )
    expect(totals).toEqual([300, 25, 50.5])
  })

  it('returns a zero for every day when there are no departments', () => {
    expect(sumDepartmentsByDay([], 2)).toEqual([0, 0])
  })

  it('treats a missing index as 0 rather than NaN (defensive against a short series)', () => {
    expect(sumDepartmentsByDay([department(['100.00'])], 2)).toEqual([100, 0])
  })

  it('poisons a day to NaN on a non-numeric value instead of summing it wrong', () => {
    const [bad, good] = sumDepartmentsByDay([department(['garbage', '5.00'])], 2)
    expect(Number.isNaN(bad)).toBe(true)
    expect(good).toBe(5)
  })
})
