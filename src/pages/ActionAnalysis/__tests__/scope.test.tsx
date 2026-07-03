import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useScopedUserIds, readScope, writeScope } from '../lib/scope'
import type { OperatorUser } from '@/features/users/api/usersApi'

function makeOp(
  id: number,
  departmentId: number | null,
  groupId: number | null = null
): OperatorUser {
  return {
    id,
    username: `u${id}`,
    full_name: `User ${id}`,
    first_name: 'F',
    middle_name: null,
    last_name: 'L',
    email: `u${id}@x`,
    status: 'active',
    asterisk_extension: `10${id}`,
    department_id: departmentId,
    department_name: departmentId != null ? `Dept ${departmentId}` : null,
    group_id: groupId,
    group_name: groupId != null ? `Group ${groupId}` : null,
  }
}

function withRoute(initialUrl: string) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  )
  return Wrapper
}

function setUser(id: number, departmentId: number | null, groupId: number | null = null) {
  // Minimal subset; only the fields useScopedUserIds reads matter.
  useAuthStore.setState({
    user: {
      id: String(id),
      active_department_id: departmentId,
      active_group_id: groupId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  })
}

const OPS: OperatorUser[] = [
  makeOp(10, 1, 5), // dept 1, group 5
  makeOp(20, 1, 5), // dept 1, group 5
  makeOp(30, 2, 6), // dept 2, group 6
  makeOp(40, null, null),
]

describe('readScope / writeScope', () => {
  it('defaults to "all" when no scope param is set (legacy URLs)', () => {
    const params = new URLSearchParams('')
    expect(readScope(params)).toBe('all')
  })

  it('reads a valid scope value', () => {
    const params = new URLSearchParams('?scope=department')
    expect(readScope(params)).toBe('department')
  })

  it('falls back to "all" for unknown scope values', () => {
    const params = new URLSearchParams('?scope=banana')
    expect(readScope(params)).toBe('all')
  })

  it('writeScope sets the param', () => {
    const out = writeScope(new URLSearchParams('?sub=list'), 'my')
    expect(out.get('scope')).toBe('my')
    expect(out.get('sub')).toBe('list')
  })
})

describe('useScopedUserIds', () => {
  beforeEach(() => {
    setUser(10, 1)
  })

  it('scope=my returns [me.id] and locks both pickers', () => {
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=my'),
    })
    expect(result.current.scope).toBe('my')
    expect(result.current.userIds).toEqual([10])
    expect(result.current.employeePickerDisabled).toBe(true)
    expect(result.current.departmentPickerDisabled).toBe(true)
    expect(result.current.isEmptyResolution).toBe(false)
  })

  it("scope=group resolves to operators in the user's group", () => {
    setUser(10, 1, 5)
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=group'),
    })
    expect(result.current.scope).toBe('group')
    expect(result.current.userIds).toEqual([10, 20])
    expect(result.current.departmentPickerDisabled).toBe(true)
    expect(result.current.isEmptyResolution).toBe(false)
  })

  it('scope=group with no group → empty resolution', () => {
    setUser(10, 1, null)
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=group'),
    })
    expect(result.current.userIds).toEqual([])
    expect(result.current.isEmptyResolution).toBe(true)
  })

  it("scope=department resolves to operators in the user's department", () => {
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=department'),
    })
    expect(result.current.userIds).toEqual([10, 20])
    expect(result.current.employeePickerDisabled).toBe(false)
    expect(result.current.departmentPickerDisabled).toBe(true)
    expect(result.current.isEmptyResolution).toBe(false)
  })

  it('scope=department with no operators in dept marks as empty resolution', () => {
    setUser(10, 99) // user in a department with no operators
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=department'),
    })
    expect(result.current.userIds).toEqual([])
    expect(result.current.isEmptyResolution).toBe(true)
  })

  it('scope=department without an active_department_id is empty', () => {
    setUser(10, null)
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=department'),
    })
    expect(result.current.isEmptyResolution).toBe(true)
    expect(result.current.employeePickerDisabled).toBe(true)
  })

  it('scope=all returns undefined and unlocks both pickers', () => {
    const { result } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=all'),
    })
    expect(result.current.userIds).toBeUndefined()
    expect(result.current.employeePickerDisabled).toBe(false)
    expect(result.current.departmentPickerDisabled).toBe(false)
  })

  it('reacts when the auth user changes', () => {
    const { result, rerender } = renderHook(() => useScopedUserIds(OPS), {
      wrapper: withRoute('/?scope=my'),
    })
    expect(result.current.userIds).toEqual([10])
    act(() => setUser(20, 1))
    rerender()
    expect(result.current.userIds).toEqual([20])
  })
})
