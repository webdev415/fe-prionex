import { describe, expect, it } from 'vitest'
import { sortTagsWithSelectedFirst } from './sortTags'

describe('sortTagsWithSelectedFirst', () => {
  const tags = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
    { id: 3, name: 'Gamma' },
  ]

  it('pins selected tags above unselected ones', () => {
    const sorted = sortTagsWithSelectedFirst(tags, [3, 1])
    expect(sorted.map((t) => t.id)).toEqual([1, 3, 2])
  })

  it('preserves relative order within each group', () => {
    const sorted = sortTagsWithSelectedFirst(tags, [2])
    expect(sorted.map((t) => t.id)).toEqual([2, 1, 3])
  })

  it('updates order when selection changes', () => {
    const first = sortTagsWithSelectedFirst(tags, [1])
    const second = sortTagsWithSelectedFirst(tags, [2])
    expect(first.map((t) => t.id)).toEqual([1, 2, 3])
    expect(second.map((t) => t.id)).toEqual([2, 1, 3])
  })
})
