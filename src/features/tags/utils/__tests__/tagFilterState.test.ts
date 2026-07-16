/**
 * Unit tests for 3-state tag filter state helpers.
 */

import { describe, it, expect } from 'vitest'
import {
  cycleTagTriState,
  getTagTriState,
  hasActiveTagFilters,
  countActiveTagFilter,
  getActiveTagFilterIds,
} from '@/features/tags/utils/tagFilterState'

describe('tagFilterState', () => {
  describe('getTagTriState', () => {
    it('returns neutral when tag is not in either list', () => {
      expect(getTagTriState({ includeIds: [1], excludeIds: [2] }, 3)).toBe('neutral')
    })

    it('returns include when tag is in includeIds', () => {
      expect(getTagTriState({ includeIds: [5], excludeIds: [] }, 5)).toBe('include')
    })

    it('returns exclude when tag is in excludeIds', () => {
      expect(getTagTriState({ includeIds: [], excludeIds: [7] }, 7)).toBe('exclude')
    })
  })

  describe('cycleTagTriState', () => {
    it('cycles neutral → include → exclude → neutral', () => {
      let state = { includeIds: [] as number[], excludeIds: [] as number[] }
      state = cycleTagTriState(state, 10)
      expect(state).toEqual({ includeIds: [10], excludeIds: [] })
      state = cycleTagTriState(state, 10)
      expect(state).toEqual({ includeIds: [], excludeIds: [10] })
      state = cycleTagTriState(state, 10)
      expect(state).toEqual({ includeIds: [], excludeIds: [] })
    })

    it('does not affect other tags when cycling one tag', () => {
      const state = { includeIds: [1, 2], excludeIds: [3] }
      const next = cycleTagTriState(state, 2)
      expect(next.includeIds).toEqual([1])
      expect(next.excludeIds).toContain(2)
      expect(next.excludeIds).toContain(3)
      expect(next.excludeIds).toHaveLength(2)
    })
  })

  describe('hasActiveTagFilters', () => {
    it('is false when both lists are empty', () => {
      expect(hasActiveTagFilters({ includeIds: [], excludeIds: [] })).toBe(false)
    })

    it('is true when only include tags are set', () => {
      expect(hasActiveTagFilters({ includeIds: [1], excludeIds: [] })).toBe(true)
    })

    it('is true when only exclude tags are set', () => {
      expect(hasActiveTagFilters({ includeIds: [], excludeIds: [2] })).toBe(true)
    })
  })

  describe('countActiveTagFilter', () => {
    it('counts as one filter regardless of how many tags are active', () => {
      expect(countActiveTagFilter({ includeIds: [1, 2], excludeIds: [3] })).toBe(1)
      expect(countActiveTagFilter({ includeIds: [], excludeIds: [] })).toBe(0)
    })
  })

  describe('getActiveTagFilterIds', () => {
    it('returns include and exclude ids combined', () => {
      expect(getActiveTagFilterIds({ includeIds: [1, 2], excludeIds: [3] })).toEqual([1, 2, 3])
    })
  })
})
