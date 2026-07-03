import { describe, expect, it } from 'vitest'
import { clampScopeToCeiling, isScopeWithinCeiling, resolveTabCeiling } from '../lib/scope'

describe('isScopeWithinCeiling', () => {
  it('treats narrower or equal scopes as within the ceiling', () => {
    expect(isScopeWithinCeiling('my', 'department')).toBe(true)
    expect(isScopeWithinCeiling('group', 'department')).toBe(true)
    expect(isScopeWithinCeiling('department', 'department')).toBe(true)
  })

  it('treats broader scopes as outside the ceiling', () => {
    expect(isScopeWithinCeiling('all', 'department')).toBe(false)
    expect(isScopeWithinCeiling('department', 'group')).toBe(false)
    expect(isScopeWithinCeiling('group', 'my')).toBe(false)
  })
})

describe('clampScopeToCeiling', () => {
  it('leaves an in-ceiling scope unchanged', () => {
    expect(clampScopeToCeiling('my', 'department')).toBe('my')
    expect(clampScopeToCeiling('group', 'group')).toBe('group')
    expect(clampScopeToCeiling('all', 'all')).toBe('all')
  })

  it('clamps an out-of-ceiling scope down to the ceiling', () => {
    expect(clampScopeToCeiling('all', 'department')).toBe('department')
    expect(clampScopeToCeiling('all', 'group')).toBe('group')
    expect(clampScopeToCeiling('department', 'my')).toBe('my')
  })
})

describe('resolveTabCeiling', () => {
  it('maps a sub-tab to its permission and reads the level', () => {
    const levels = { view_call_list: 'group', view_payment_history: 'department' }
    expect(resolveTabCeiling('list', levels)).toBe('group')
    expect(resolveTabCeiling('payment-history', levels)).toBe('department')
  })

  it('defaults to "all" for tabs with no configured level', () => {
    expect(resolveTabCeiling('heatmap', { view_call_list: 'my' })).toBe('all')
    expect(resolveTabCeiling('list', undefined)).toBe('all')
  })

  it('defaults to "all" for an unknown/non-scoped sub-tab', () => {
    expect(resolveTabCeiling('script-analytics', { view_call_list: 'my' })).toBe('all')
  })

  it('ignores a malformed level value', () => {
    expect(resolveTabCeiling('list', { view_call_list: 'bogus' })).toBe('all')
  })
})
