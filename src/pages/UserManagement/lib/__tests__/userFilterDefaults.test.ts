import { describe, it, expect } from 'vitest'
import {
  ALL_FILTER_VALUE,
  DEFAULT_USER_FILTERS,
  DEFAULT_USER_STATUS_FILTER,
  isUserFilterActive,
  statusFilterToApiStatus,
} from '../userFilterDefaults'

describe('userFilterDefaults', () => {
  it('maps status filter values to API status', () => {
    expect(statusFilterToApiStatus('all')).toBeUndefined()
    expect(statusFilterToApiStatus('active')).toBe('active')
    expect(statusFilterToApiStatus('disabled')).toBe('inactive')
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
