import { describe, it, expect } from 'vitest'
import { ACCESS_LEVEL_OPTIONS, DEFAULT_ACCESS_LEVEL, isTabAccessPermission } from '../accessLevels'

describe('accessLevels', () => {
  it('recognises the 8 Action Analysis tab permissions', () => {
    for (const name of [
      'view_call_list',
      'view_interaction_history',
      'view_ta_history',
      'view_task_history',
      'view_payment_history',
      'view_click_tracking',
      'view_screen_time',
      'view_activity_heatmap',
    ]) {
      expect(isTabAccessPermission(name)).toBe(true)
    }
  })

  it('does not treat unrelated permissions as tab permissions', () => {
    expect(isTabAccessPermission('manage_roles')).toBe(false)
    expect(isTabAccessPermission('view_action_analysis')).toBe(false)
  })

  it('offers the four cumulative levels with "all" as default', () => {
    expect(ACCESS_LEVEL_OPTIONS.map((o) => o.value)).toEqual(['my', 'group', 'department', 'all'])
    expect(DEFAULT_ACCESS_LEVEL).toBe('all')
  })
})
