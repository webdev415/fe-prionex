import { describe, expect, it } from 'vitest'
import {
  compareTagsByOrder,
  compareRelatedTagEntries,
  sortTagsByOrder,
  sortTagsWithSelectedFirst,
} from './sortTags'

describe('sortTagsByOrder', () => {
  const tags = [
    { id: 1, name: 'Beta', sort_order: 20 },
    { id: 2, name: 'Alpha', sort_order: 10 },
    { id: 3, name: 'Gamma', sort_order: 10 },
    { id: 4, name: 'Delta' },
  ]

  it('sorts by sort_order ascending, then name alphabetically', () => {
    const sorted = sortTagsByOrder(tags)
    expect(sorted.map((t) => t.id)).toEqual([2, 3, 1, 4])
  })

  it('defaults missing sort_order to 100', () => {
    expect(
      compareTagsByOrder({ id: 1, name: 'Z' }, { id: 2, name: 'A', sort_order: 10 })
    ).toBeGreaterThan(0)
  })
})

describe('sortTagsWithSelectedFirst', () => {
  const tags = [
    { id: 1, name: 'Alpha', sort_order: 30 },
    { id: 2, name: 'Beta', sort_order: 10 },
    { id: 3, name: 'Gamma', sort_order: 20 },
  ]

  it('pins selected tags above unselected ones', () => {
    const sorted = sortTagsWithSelectedFirst(tags, [3, 1])
    expect(sorted.map((t) => t.id)).toEqual([3, 1, 2])
  })

  it('applies sort order within each group independently', () => {
    const sorted = sortTagsWithSelectedFirst(tags, [3])
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 1])
  })

  it('updates order when selection changes', () => {
    const first = sortTagsWithSelectedFirst(tags, [1])
    const second = sortTagsWithSelectedFirst(tags, [2])
    expect(first.map((t) => t.id)).toEqual([1, 2, 3])
    expect(second.map((t) => t.id)).toEqual([2, 3, 1])
  })
})

describe('compareRelatedTagEntries', () => {
  it('sorts globally by tag order across linked clients', () => {
    const alpha = { tag: { id: 1, name: 'Alpha', sort_order: 10 }, linkedClientId: 99 }
    const beta = { tag: { id: 2, name: 'Beta', sort_order: 20 }, linkedClientId: 48 }
    expect(compareRelatedTagEntries(alpha, beta)).toBeLessThan(0)
    expect(compareRelatedTagEntries(beta, alpha)).toBeGreaterThan(0)
  })

  it('uses linked client id when tag sort keys tie', () => {
    const tag = { id: 1, name: 'Shared', sort_order: 10 }
    const from48 = { tag, linkedClientId: 48 }
    const from99 = { tag, linkedClientId: 99 }
    expect(compareRelatedTagEntries(from48, from99)).toBeLessThan(0)
  })
})
