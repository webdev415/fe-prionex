import { describe, expect, it } from 'vitest'
import { countAppliedFilters } from '../appliedFiltersCount'
import type { ClientFilters } from '../ClientManagementPage'

const none: ClientFilters = {
  portfolio: [],
  tagIds: [],
  rrStatusIds: [],
  excludeTagIds: [],
  responsibleEmployeeIds: [],
  interactionUserIds: [],
  chainIds: [],
  chainStepIds: [],
  stepValues: {},
}

describe('countAppliedFilters', () => {
  it('counts nothing when no filter is set', () => {
    expect(countAppliedFilters(none, 0, 0)).toBe(0)
  })

  it('counts an RR status filter', () => {
    expect(countAppliedFilters({ ...none, rrStatusIds: [1] }, 0, 0)).toBe(1)
  })

  it('counts each kind of filter once', () => {
    expect(
      countAppliedFilters(
        { ...none, rrStatusIds: [1, 2], portfolio: [3], unassignedOnly: true },
        2,
        0
      )
    ).toBe(4)
  })
})
