import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { useSmsServiceAvailable } from '../useSmsServiceAvailable'

function operatorIn(country: string | undefined): User {
  return {
    id: '1',
    username: 'operator',
    projects: [{ id: '2', name: 'Project', country, roles: [] }],
    active_project_id: '2',
    active_role_id: null,
    active_role_name: null,
    active_department_id: null,
    is_agent: false,
    agent_status: 'offline',
  } as User
}

describe('useSmsServiceAvailable', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('offers sms-service on a Ukrainian project', () => {
    useAuthStore.setState({ user: operatorIn('UA') })
    expect(renderHook(() => useSmsServiceAvailable()).result.current).toBe(true)
  })

  it('hides sms-service on a Spanish project', () => {
    useAuthStore.setState({ user: operatorIn('ES') })
    expect(renderHook(() => useSmsServiceAvailable()).result.current).toBe(false)
  })

  it('treats a project without a country as Ukrainian', () => {
    useAuthStore.setState({ user: operatorIn(undefined) })
    expect(renderHook(() => useSmsServiceAvailable()).result.current).toBe(true)
  })
})
