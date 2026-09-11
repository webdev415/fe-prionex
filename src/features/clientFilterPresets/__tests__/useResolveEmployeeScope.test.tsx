/**
 * Relative scopes are resolved against the directory as it stands when the
 * preset is applied, which is the reason presets store a scope at all.
 *
 * The cases worth pinning are the degenerate ones. An operator with no group
 * resolves "my group" to nobody — the resolver then drops the filter, which is
 * correct; falling back to everyone would widen a preset meant to narrow. But
 * "everyone except my group" with no group is everyone, because there is no
 * group to take out. Getting those two backwards is silent and damaging.
 */

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { user: { id: '5', active_group_id: 2, active_department_id: 8 } as unknown }

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

const OPERATORS = [
  { id: 5, group_id: 2, department_id: 8 }, // me
  { id: 6, group_id: 2, department_id: 8 }, // my group
  { id: 7, group_id: 3, department_id: 8 }, // my department, other group
  { id: 8, group_id: 4, department_id: 9 }, // elsewhere
]

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({ data: OPERATORS }),
}))

const { useResolveEmployeeScope } = await import('../hooks/useResolveEmployeeScope')

beforeEach(() => {
  authState.user = { id: '5', active_group_id: 2, active_department_id: 8 }
})

const resolve = () => renderHook(() => useResolveEmployeeScope(1)).result.current

describe('useResolveEmployeeScope', () => {
  it('resolves my group and my department', () => {
    const r = resolve()
    expect(r('myGroup')).toEqual([5, 6])
    expect(r('myDepartment')).toEqual([5, 6, 7])
  })

  it('excludes me, my group and my department', () => {
    const r = resolve()
    expect(r('everyoneExceptMe')).toEqual([6, 7, 8])
    expect(r('everyoneExceptMyGroup')).toEqual([7, 8])
    expect(r('everyoneExceptMyDepartment')).toEqual([8])
  })

  it('resolves "my group" to nobody when the operator has no group', () => {
    authState.user = { id: '5', active_group_id: null, active_department_id: 8 }
    const r = resolve()
    // Not everyone — the resolver drops an empty list, so the filter is absent
    // rather than silently matching the whole directory.
    expect(r('myGroup')).toEqual([])
  })

  it('resolves "everyone except my group" to everyone when there is no group', () => {
    authState.user = { id: '5', active_group_id: null, active_department_id: null }
    const r = resolve()
    expect(r('everyoneExceptMyGroup')).toEqual([5, 6, 7, 8])
    expect(r('everyoneExceptMyDepartment')).toEqual([5, 6, 7, 8])
  })
})
