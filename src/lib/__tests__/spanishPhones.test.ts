import { afterEach, describe, expect, it } from 'vitest'
import {
  formatUkrainePhoneForDisplay,
  isDialablePhone,
  isValidManualDialDigits,
  normalizeUkrainePhoneToDb,
} from '@/lib/phone'
import { activeCountry, activeProjectCountry, setActiveCountry } from '@/lib/projectCountry'
import { useAuthStore } from '@/stores/authStore'
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

describe('formatUkrainePhoneForDisplay', () => {
  it.each(['34612345678', '+34 612 345 678', '0034612345678'])(
    'shows the Spanish number %s with its country code',
    (value) => {
      expect(formatUkrainePhoneForDisplay(value)).toBe('+34612345678')
    }
  )

  it('keeps showing Ukrainian numbers as before', () => {
    expect(formatUkrainePhoneForDisplay('380971234567')).toBe('+380971234567')
    expect(formatUkrainePhoneForDisplay('0971234567')).toBe('+380971234567')
  })

  it('leaves anything else as typed', () => {
    expect(formatUkrainePhoneForDisplay('34512345678')).toBe('34512345678')
    expect(formatUkrainePhoneForDisplay('')).toBe('-')
  })
})

describe('bare nine-digit numbers follow the project country', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
    setActiveCountry('UA')
  })

  it.each([
    ['612345678', '+34612345678'],
    ['912345678', '+34912345678'],
  ])('shows %s as a Spanish number in a Spanish project', (value, shown) => {
    expect(formatUkrainePhoneForDisplay(value, '-', 'ES')).toBe(shown)
  })

  it.each(['512345678', '0612345678', '06 12 34 56 78'])(
    'never adds a Ukrainian code to %s in a Spanish project',
    (value) => {
      expect(normalizeUkrainePhoneToDb(value, 'ES')).toBeNull()
      expect(formatUkrainePhoneForDisplay(value, '-', 'ES')).toBe(value)
    }
  )

  it.each(['612345678', '+34 612 345 678', '0034612345678'])(
    'leaves %s for the note to store as typed in a Spanish project',
    (value) => {
      expect(normalizeUkrainePhoneToDb(value, 'ES')).toBeNull()
    }
  )

  it('keeps explicit Ukrainian numbers in a Spanish project', () => {
    expect(normalizeUkrainePhoneToDb('+380 97 123 45 67', 'ES')).toBe('380971234567')
    expect(formatUkrainePhoneForDisplay('380971234567', '-', 'ES')).toBe('+380971234567')
  })

  it('keeps the Ukrainian reading in a Ukrainian project', () => {
    expect(normalizeUkrainePhoneToDb('671234567', 'UA')).toBe('380671234567')
    expect(normalizeUkrainePhoneToDb('0501234567', 'UA')).toBe('380501234567')
    expect(formatUkrainePhoneForDisplay('671234567', '-', 'UA')).toBe('+380671234567')
  })

  it('reads the active project country by default', () => {
    setActiveCountry('ES')
    expect(formatUkrainePhoneForDisplay('612345678')).toBe('+34612345678')
    setActiveCountry('UA')
    expect(formatUkrainePhoneForDisplay('612345678')).toBe('+380612345678')
  })

  it('follows the project the user switches to', () => {
    useAuthStore.setState({
      user: {
        id: '1',
        projects: [{ id: '2', name: 'Madrid', country: 'ES', roles: [] }],
        active_project_id: '2',
      } as unknown as User,
    })

    expect(activeCountry()).toBe('ES')
  })
})
