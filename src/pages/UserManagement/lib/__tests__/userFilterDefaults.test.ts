import { describe, it, expect } from 'vitest'
import {
  ALL_FILTER_VALUE,
  DEFAULT_USER_FILTERS,
  DEFAULT_USER_STATUS_FILTER,
  isUserFilterActive,
  statusFilterToApiStatus,
  asStatusFilter,
} from '../userFilterDefaults'

describe('userFilterDefaults', () => {
  it('maps status filter values to API status', () => {
    expect(statusFilterToApiStatus('all')).toBeUndefined()
    expect(statusFilterToApiStatus('active')).toBe('active')
    expect(statusFilterToApiStatus('inactive')).toBe('inactive')
  })

  it('still understands the word a bookmarked link may carry', () => {
    expect(asStatusFilter('disabled')).toBe('inactive')
  })

  it.each(['all', 'active', 'inactive'] as const)('keeps %s as it is', (value) => {
    expect(asStatusFilter(value)).toBe(value)
  })

  it.each([undefined, null, 42, '', 'nonsense'])('falls back to the default for %s', (value) => {
    expect(asStatusFilter(value)).toBe(DEFAULT_USER_STATUS_FILTER)
  })

  it('defaults status to active', () => {
    expect(DEFAULT_USER_STATUS_FILTER).toBe('active')
    expect(DEFAULT_USER_FILTERS.statusFilter).toBe('active')
  })

  it('treats only non-default filters as active', () => {
    expect(isUserFilterActive('roleId', ALL_FILTER_VALUE)).toBe(false)
    expect(isUserFilterActive('roleId', 3)).toBe(true)
    expect(isUserFilterActive('statusFilter', 'active')).toBe(false)
    expect(isUserFilterActive('statusFilter', 'all')).toBe(true)
  })
})
