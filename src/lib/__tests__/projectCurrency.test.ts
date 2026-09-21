import { afterEach, describe, expect, it } from 'vitest'
import {
  activeCurrency,
  activeProjectCurrency,
  currencySymbol,
  setActiveCurrency,
} from '@/lib/projectCurrency'
import { mapBackendUserToUser, mergeUserFromProjectsResponse } from '@/lib/mapBackendUser'
import type { CurrentUserResponse, User } from '@/types/api'

function userWith(projects: User['projects'], activeProjectId: string | null): User {
  return {
    id: '1',
    username: 'operator',
    projects,
    active_project_id: activeProjectId,
    active_role_id: null,
    active_role_name: null,
    active_department_id: null,
    is_agent: false,
    agent_status: 'offline',
  } as User
}

describe('project currency', () => {
  afterEach(() => {
    setActiveCurrency('UAH')
  })

  it('takes the currency of the active project', () => {
    const user = userWith(
      [
        { id: '1', name: 'Kyiv', currency: 'UAH', roles: [] },
        { id: '2', name: 'Madrid', currency: 'EUR', roles: [] },
      ],
      '2'
    )

    expect(activeProjectCurrency(user)).toBe('EUR')
  })

  it('falls back to hryvnia when nothing says otherwise', () => {
    expect(activeProjectCurrency(null)).toBe('UAH')
    expect(activeProjectCurrency({ active_project_id: '1' })).toBe('UAH')
    expect(activeProjectCurrency(userWith([{ id: '1', name: 'Kyiv', roles: [] }], '1'))).toBe('UAH')
    expect(
      activeProjectCurrency(userWith([{ id: '1', name: 'X', currency: 'USD', roles: [] }], '1'))
    ).toBe('UAH')
  })

  it('switches the symbol with the active currency', () => {
    expect(currencySymbol()).toBe('₴')

    setActiveCurrency('EUR')

    expect(activeCurrency()).toBe('EUR')
    expect(currencySymbol()).toBe('€')
  })

  it('keeps each project currency from /users/me', () => {
    const user = mapBackendUserToUser({
      id: 1,
      username: 'operator',
      role: { id: 3, name: 'Operator' },
      active_project: { id: 2, name: 'Madrid', code: 'MAD' },
      projects: [{ id: 2, name: 'Madrid', code: 'MAD', role_name: 'Operator', currency: 'EUR' }],
      created_at: '2026-01-01T00:00:00Z',
    } as CurrentUserResponse)

    expect(user.projects[0].currency).toBe('EUR')
  })

  it('keeps each project currency from /users/me/projects', () => {
    const merged = mergeUserFromProjectsResponse(userWith([], null), {
      projects: [
        {
          project_id: 2,
          project_name: 'Madrid',
          project_code: 'MAD',
          role_id: 3,
          role_name: 'Operator',
          is_active: true,
          currency: 'EUR',
        },
      ],
    })

    expect(activeProjectCurrency(merged)).toBe('EUR')
  })
})
