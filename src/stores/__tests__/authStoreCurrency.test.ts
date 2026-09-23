import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import type { User } from '@/types/api'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: {
    validate: vi.fn(),
    me: vi.fn(),
    myProjects: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    exitImpersonation: vi.fn(),
  },
}))

function operatorIn(activeProjectId: string): User {
  return {
    id: '1',
    username: 'operator',
    projects: [
      { id: '1', name: 'Kyiv', currency: 'UAH', roles: [] },
      { id: '2', name: 'Madrid', currency: 'EUR', roles: [] },
    ],
    active_project_id: activeProjectId,
    active_role_id: null,
    active_role_name: null,
    active_department_id: null,
    is_agent: false,
    agent_status: 'offline',
  } as User
}

describe('amounts follow the active project', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('shows euros in a euro project and hryvnia again after switching back', () => {
    useAuthStore.setState({ user: operatorIn('2') })
    expect(formatMoneyUAHTwoDecimals(1234.5)).toBe('€1,234.50')

    useAuthStore.setState({ user: operatorIn('1') })
    expect(formatMoneyUAHTwoDecimals(1234.5)).toBe('₴ 1 234.50')
  })

  it('goes back to hryvnia on logout', () => {
    useAuthStore.setState({ user: operatorIn('2') })
    useAuthStore.setState({ user: null })

    expect(formatMoneyUAHTwoDecimals(10)).toBe('₴ 10.00')
  })
})
