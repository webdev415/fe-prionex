import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { useUbkiAvailable } from '../useUbkiAvailable'

function operatorIn(country: string | undefined, active_project_country?: string): User {
  return {
    id: '1',
    username: 'operator',
    projects: [{ id: '2', name: 'Project', country, roles: [] }],
    active_project_id: '2',
    active_project_country,
    active_role_id: null,
    active_role_name: null,
    active_department_id: null,
    is_agent: false,
    agent_status: 'offline',
  } as User
}

describe('useUbkiAvailable', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('offers UBKI in a Ukrainian project', () => {
    useAuthStore.setState({ user: operatorIn('UA') })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(true)
  })

  it('hides UBKI in a Spanish project', () => {
    useAuthStore.setState({ user: operatorIn('ES') })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(false)
  })

  it('treats a project without a country as Ukrainian', () => {
    useAuthStore.setState({ user: operatorIn(undefined) })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(true)
  })

  it('hides UBKI in a Canadian project', () => {
    useAuthStore.setState({ user: operatorIn('CA') })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(false)
  })

  it('hides UBKI when only the active project from /me says CA', () => {
    useAuthStore.setState({ user: operatorIn(undefined, 'CA') })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(false)
  })

  it('hides UBKI in the Canadian project of a user who also works in a Ukrainian one', () => {
    useAuthStore.setState({
      user: {
        ...operatorIn('CA'),
        projects: [
          { id: '1', name: 'Ukraine', country: 'UA', roles: [] },
          { id: '3', name: 'Canada', country: 'CA', roles: [] },
        ],
        active_project_id: '3',
      },
    })

    expect(renderHook(() => useUbkiAvailable()).result.current).toBe(false)
  })
})
