import { describe, expect, it } from 'vitest'
import { defaultDeadline } from '../deadline'

describe('defaultDeadline', () => {
  it('returns a datetime-local string (no zone suffix)', () => {
    expect(defaultDeadline()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('defaults to a future time (next day)', () => {
    expect(new Date(defaultDeadline()).getTime()).toBeGreaterThan(Date.now())
  })

  it('honours the daysAhead argument', () => {
    const oneDay = 24 * 60 * 60 * 1000
    const diff = new Date(defaultDeadline(3)).getTime() - new Date(defaultDeadline(1)).getTime()
    expect(Math.round(diff / oneDay)).toBe(2)
  })
})
