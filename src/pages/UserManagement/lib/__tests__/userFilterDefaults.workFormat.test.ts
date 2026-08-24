import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_FILTERS,
  DEFAULT_WORK_FORMAT_FILTER,
  isUserFilterActive,
  parseDepartmentIds,
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

describe('the department filter', () => {
  it('starts empty, meaning every department', () => {
    expect(DEFAULT_USER_FILTERS.departmentIds).toEqual([])
  })

  it('counts as applied only once one is picked', () => {
    expect(isUserFilterActive('departmentIds', [])).toBe(false)
    expect(isUserFilterActive('departmentIds', [3])).toBe(true)
    expect(isUserFilterActive('departmentIds', [3, 4])).toBe(true)
  })
})

describe('reading a department filter that was stored earlier', () => {
  it('survives the number this filter used to be', () => {
    // Before it became a multi-select the value was a single id, and it is
    // still in localStorage for anyone who used the page. Treating it as a
    // string crashed the whole page on mount.
    expect(parseDepartmentIds(5)).toEqual([5])
  })

  it('reads the old all sentinel as no filter', () => {
    expect(parseDepartmentIds(0)).toEqual([])
  })

  it('reads the list it stores today', () => {
    expect(parseDepartmentIds('3,4')).toEqual([3, 4])
  })

  it('copes with an array, an empty string and nothing at all', () => {
    expect(parseDepartmentIds([3, '4'])).toEqual([3, 4])
    expect(parseDepartmentIds('')).toEqual([])
    expect(parseDepartmentIds(null)).toEqual([])
    expect(parseDepartmentIds(undefined)).toEqual([])
  })

  it('drops anything that is not an id', () => {
    expect(parseDepartmentIds('3,abc,-1,0,4')).toEqual([3, 4])
    expect(parseDepartmentIds({})).toEqual([])
  })
})
