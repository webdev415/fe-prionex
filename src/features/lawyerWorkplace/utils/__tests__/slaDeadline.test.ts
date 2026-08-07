import { describe, it, expect } from 'vitest'
import { addSlaDays } from '../slaDeadline'

// 2021-01-01 is a Friday (local time), used as the anchor for the examples.
const friday = () => new Date(2021, 0, 1, 9, 30, 0)

describe('addSlaDays', () => {
  it('adds calendar days as-is (Friday + 2 calendar → Sunday)', () => {
    const result = addSlaDays(friday(), 2, 'calendar')
    expect(result.getFullYear()).toBe(2021)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(3) // Sunday 2021-01-03
    expect(result.getDay()).toBe(0)
  })

  it('skips the weekend for working days (Friday + 2 working → Tuesday)', () => {
    const result = addSlaDays(friday(), 2, 'working')
    expect(result.getDate()).toBe(5) // Tuesday 2021-01-05
    expect(result.getDay()).toBe(2)
  })

  it('skips a full weekend inside the span (Thursday + 3 working → Tuesday)', () => {
    const thursday = new Date(2021, 0, 7, 9, 0, 0) // Thu 2021-01-07
    const result = addSlaDays(thursday, 3, 'working')
    // Fri(1) → Sat/Sun skip → Mon(2) → Tue(3) = 2021-01-12
    expect(result.getDate()).toBe(12)
    expect(result.getDay()).toBe(2)
  })

  it('preserves the time-of-day', () => {
    const result = addSlaDays(friday(), 2, 'working')
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(30)
  })

  it('returns an unchanged copy for non-positive SLA', () => {
    const base = friday()
    const result = addSlaDays(base, 0, 'working')
    expect(result.getTime()).toBe(base.getTime())
    expect(result).not.toBe(base)
  })
})
