import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { canAssignLawyer, formatLawyerCapacityLabel, isLawyerAtCapacity } from '../lawyerCapacity'

describe('isLawyerAtCapacity', () => {
  it('is false when max_in_flight is not positive (no limit)', () => {
    expect(isLawyerAtCapacity({ current_active: 5, max_in_flight: 0 })).toBe(false)
  })

  it('is true once active reaches the max', () => {
    expect(isLawyerAtCapacity({ current_active: 5, max_in_flight: 5 })).toBe(true)
    expect(isLawyerAtCapacity({ current_active: 4, max_in_flight: 5 })).toBe(false)
  })
})

describe('canAssignLawyer', () => {
  it('always allows the current assignee even at capacity', () => {
    expect(canAssignLawyer({ user_id: 7, current_active: 5, max_in_flight: 5 }, 7)).toBe(true)
  })

  it('blocks a different lawyer who is at capacity', () => {
    expect(canAssignLawyer({ user_id: 8, current_active: 5, max_in_flight: 5 }, 7)).toBe(false)
  })
})

describe('formatLawyerCapacityLabel', () => {
  it('interpolates current/max through the provided t and returns its result', () => {
    const tMock = vi.fn(
      (_key: string, defaultValue: string, opts?: { current: number; max: number }) =>
        defaultValue
          .replace('{{current}}', String(opts?.current))
          .replace('{{max}}', String(opts?.max))
    )
    const t = tMock as unknown as TFunction

    const label = formatLawyerCapacityLabel({ current_active: 3, max_in_flight: 5 }, t)

    expect(label).toBe('At capacity (3/5)')
    expect(tMock).toHaveBeenCalledWith(
      'pages.lawyerWorkplace.lawyers.atCapacity',
      'At capacity ({{current}}/{{max}})',
      { current: 3, max: 5 }
    )
  })
})
