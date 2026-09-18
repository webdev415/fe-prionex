import { describe, expect, it } from 'vitest'
import { isDialablePhone, isValidManualDialDigits } from '@/lib/phone'
import { activeProjectCountry } from '@/lib/projectCountry'
import { mapBackendUserToUser, mergeUserFromProjectsResponse } from '@/lib/mapBackendUser'
import type { CurrentUserResponse, User } from '@/types/api'

describe('isDialablePhone', () => {
  it.each(['+380 97 123 45 67', '380971234567', '0971234567', '(097) 123-45-67'])(
    'accepts the Ukrainian number %s',
    (value) => {
      expect(isDialablePhone(value)).toBe(true)
    }
  )

  it.each(['+34 612 345 678', '34612345678', '0034 912 345 678'])(
    'accepts the Spanish number %s',
    (value) => {
      expect(isDialablePhone(value)).toBe(true)
    }
  )

  it.each(['612345678', '+34512345678', '12345', 'ivan@example.com'])('rejects %s', (value) => {
    expect(isDialablePhone(value)).toBe(false)
  })
})

describe('isValidManualDialDigits', () => {
  it('accepts 380 and 34 numbers', () => {
    expect(isValidManualDialDigits('380971234567')).toBe(true)
    expect(isValidManualDialDigits('34612345678')).toBe(true)
  })

  it('rejects incomplete or unknown numbers', () => {
    expect(isValidManualDialDigits('38097123456')).toBe(false)
    expect(isValidManualDialDigits('3461234567')).toBe(false)
    expect(isValidManualDialDigits('34512345678')).toBe(false)
    expect(isValidManualDialDigits('612345678')).toBe(false)
  })
})

describe('project country', () => {
  const base = {
    id: '1',
    username: 'operator',
    active_role_id: null,
    active_role_name: null,
    active_department_id: null,
    is_agent: false,
    agent_status: 'offline',
  }

  it('reads the country of the active project', () => {
    const user = {
      ...base,
      projects: [
        { id: '1', name: 'Kyiv', country: 'UA', roles: [] },
        { id: '2', name: 'Madrid', country: 'ES', roles: [] },
      ],
      active_project_id: '2',
    } as User

    expect(activeProjectCountry(user)).toBe('ES')
  })

  it('falls back to Ukraine', () => {
    expect(activeProjectCountry(null)).toBe('UA')
    expect(activeProjectCountry({ active_project_id: '1' })).toBe('UA')
  })

  it('keeps each project country from both user responses', () => {
    const fromMe = mapBackendUserToUser({
      id: 1,
      username: 'operator',
      role: { id: 3, name: 'Operator' },
      active_project: { id: 2, name: 'Madrid', code: 'MAD' },
      projects: [{ id: 2, name: 'Madrid', code: 'MAD', role_name: 'Operator', country: 'ES' }],
      created_at: '2026-01-01T00:00:00Z',
    } as CurrentUserResponse)
    const fromProjects = mergeUserFromProjectsResponse(
      { ...base, projects: [] } as unknown as User,
      {
        projects: [
          {
            project_id: 2,
            project_name: 'Madrid',
            project_code: 'MAD',
            role_id: 3,
            role_name: 'Operator',
            is_active: true,
            country: 'ES',
          },
        ],
      }
    )

    expect(activeProjectCountry(fromMe)).toBe('ES')
    expect(activeProjectCountry(fromProjects)).toBe('ES')
  })
})
