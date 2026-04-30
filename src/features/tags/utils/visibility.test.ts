import { describe, expect, it } from 'vitest'
import { isOperatorVisibleTag } from './visibility'

describe('isOperatorVisibleTag', () => {
  it('hides tags with hidden visibility', () => {
    expect(isOperatorVisibleTag({ visibility: 'hidden' })).toBe(false)
    expect(isOperatorVisibleTag({ visibility: 'HIDDEN' })).toBe(false)
  })

  it('keeps non-hidden tags visible to operators', () => {
    expect(isOperatorVisibleTag({ visibility: 'ui' })).toBe(true)
    expect(isOperatorVisibleTag({ visibility: 'analytics' })).toBe(true)
  })

  it('hides system visibility tags for operators', () => {
    expect(isOperatorVisibleTag({ visibility: 'system' })).toBe(false)
    expect(isOperatorVisibleTag({ visibility: 'SYSTEM' })).toBe(false)
  })

  it('keeps legacy tags without visibility visible', () => {
    expect(isOperatorVisibleTag({})).toBe(true)
    expect(isOperatorVisibleTag({ visibility: null })).toBe(true)
  })
})
