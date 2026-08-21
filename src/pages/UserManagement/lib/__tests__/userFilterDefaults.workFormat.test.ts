import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_FILTERS,
  DEFAULT_WORK_FORMAT_FILTER,
  isUserFilterActive,
  workFormatToApiValue,
} from '../userFilterDefaults'

describe('the work format filter', () => {
  it('starts as all, so the list is not narrowed before anyone asks', () => {
    expect(DEFAULT_USER_FILTERS.workFormat).toBe('all')
    expect(DEFAULT_WORK_FORMAT_FILTER).toBe('all')
  })

  it('sends nothing to the API while it is all', () => {
    expect(workFormatToApiValue('all')).toBeUndefined()
  })

  it('sends the chosen value', () => {
    expect(workFormatToApiValue('office')).toBe('office')
    expect(workFormatToApiValue('remote')).toBe('remote')
  })

  it('counts as applied only once it is narrowed', () => {
    expect(isUserFilterActive('workFormat', 'all')).toBe(false)
    expect(isUserFilterActive('workFormat', 'office')).toBe(true)
    expect(isUserFilterActive('workFormat', 'remote')).toBe(true)
  })
})
