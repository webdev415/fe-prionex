import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from '@/lib/api'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/stores/authStore'
import { activeCurrency } from '@/lib/projectCurrency'
import { activeCountry } from '@/lib/projectCountry'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { mapBackendUserToUser } from '@/lib/mapBackendUser'

vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  applyPersistedLanguageFromServer: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: {
    validate: vi.fn(),
    me: vi.fn(),
    myProjects: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    impersonate: vi.fn(),
    exitImpersonation: vi.fn(),
  },
}))

const b64url = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`
const FUTURE = Math.floor(Date.now() / 1000) + 3600
const netErr = Object.assign(new Error('Network Error'), {
  isAxiosError: true,
  code: 'ERR_NETWORK',
})

const CACHE = JSON.stringify({
  '1': { currency: 'UAH', country: 'UA' },
  '2': { currency: 'EUR', country: 'ES' },
})

function operatorToken(activeProjectId: number) {
  return jwt({
    user_id: 7,
    username: 'operator',
    project_ids: [1, 2],
    active_project_id: activeProjectId,
    active_role_id: 3,
    permissions: ['clients.view'],
    exp: FUTURE,
  })
}

function meFor(activeProjectId: number) {
  return {
    data: {
      id: 7,
      username: 'operator',
      email: 'operator@example.com',
      first_name: 'Ana',
      last_name: 'Ruiz',
      full_name: 'Ana Ruiz',
      status: 'active',
      timezone: 'Europe/Madrid',
      role: { id: 3, name: 'Operator' },
      active_project: { id: activeProjectId, name: 'Madrid', code: 'MAD' },
      projects: [
        { id: 1, name: 'Kyiv', code: 'KYV', role_name: 'Operator', currency: 'UAH', country: 'UA' },
        {
          id: 2,
          name: 'Madrid',
          code: 'MAD',
          role_name: 'Operator',
          currency: 'EUR',
          country: 'ES',
        },
      ],
      permissions: ['clients.view'],
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

describe('project currency and country while auth is unreachable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasCheckedAuth: false,
      isImpersonating: false,
      impersonatedUser: null,
      originalAdminUser: null,
    })
  })

  afterEach(() => {
    setAccessToken(null)
  })

  it('remembers every project currency and country from /me without changing the user', async () => {
    setAccessToken(operatorToken(2))
    vi.mocked(authApi.validate).mockResolvedValue({ data: { valid: true } } as never)
    vi.mocked(authApi.me).mockResolvedValue(meFor(2) as never)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user).toEqual(mapBackendUserToUser(meFor(2).data as never))
    expect(JSON.parse(localStorage.getItem('project_settings') ?? '{}')).toEqual(JSON.parse(CACHE))
  })

  it('keeps euros and Spanish rules after a reload during an outage', async () => {
    localStorage.setItem('project_settings', CACHE)
    setAccessToken(operatorToken(2))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(activeCurrency()).toBe('EUR')
    expect(activeCountry()).toBe('ES')
    expect(formatMoneyUAHTwoDecimals(1234.5)).toBe('€1,234.50')
  })

  it('reads the cache by project id, so a Ukrainian project stays in hryvnia', async () => {
    localStorage.setItem('project_settings', CACHE)
    setAccessToken(operatorToken(1))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    expect(activeCurrency()).toBe('UAH')
    expect(activeCountry()).toBe('UA')
    expect(formatMoneyUAHTwoDecimals(1234.5)).toBe('₴ 1 234.50')
  })

  it('falls back to hryvnia when the cache cannot be read', async () => {
    localStorage.setItem('project_settings', '{not json')
    setAccessToken(operatorToken(2))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(activeCurrency()).toBe('UAH')
    expect(activeCountry()).toBe('UA')
  })

  it('keeps euros when a profile refresh cannot reach auth', async () => {
    setAccessToken(operatorToken(2))
    vi.mocked(authApi.validate).mockResolvedValue({ data: { valid: true } } as never)
    vi.mocked(authApi.me).mockResolvedValueOnce(meFor(2) as never)
    await useAuthStore.getState().checkAuth()

    vi.mocked(authApi.me).mockRejectedValue(netErr)
    vi.mocked(authApi.myProjects).mockRejectedValue(netErr)
    await useAuthStore.getState().refreshUser()

    expect(activeCurrency()).toBe('EUR')
    expect(activeCountry()).toBe('ES')
  })

  it('uses the remembered project settings when /me fails while starting impersonation', async () => {
    localStorage.setItem('project_settings', CACHE)
    useAuthStore.setState({
      user: mapBackendUserToUser(meFor(1).data as never),
      isAuthenticated: true,
    })
    vi.mocked(authApi.impersonate).mockResolvedValue({
      data: {
        success: true,
        message: '',
        data: {
          impersonation_token: jwt({ user_id: 7, is_impersonation: true, exp: FUTURE }),
          impersonated_user: {
            id: 5,
            username: 'target',
            email: '',
            first_name: 'T',
            last_name: 'U',
          },
          active_project: {
            project_id: 2,
            project_name: 'Madrid',
            role_id: 3,
            role_name: 'Operator',
          },
          permissions: ['clients.view'],
        },
      },
    } as never)
    vi.mocked(authApi.me).mockRejectedValue(netErr)

    await useAuthStore.getState().startImpersonation(5)

    expect(activeCurrency()).toBe('EUR')
    expect(activeCountry()).toBe('ES')
  })

  it('lets the server beat a stale cache for a Ukrainian project', async () => {
    localStorage.setItem(
      'project_settings',
      JSON.stringify({ '1': { currency: 'EUR', country: 'ES' } })
    )
    setAccessToken(operatorToken(1))
    vi.mocked(authApi.validate).mockResolvedValue({ data: { valid: true } } as never)
    vi.mocked(authApi.me).mockResolvedValue(meFor(1) as never)

    await useAuthStore.getState().checkAuth()

    expect(activeCurrency()).toBe('UAH')
    expect(activeCountry()).toBe('UA')
    expect(JSON.parse(localStorage.getItem('project_settings') ?? '{}')['1']).toEqual({
      currency: 'UAH',
      country: 'UA',
    })
  })

  it('does not wipe the cache while offline', async () => {
    const other = JSON.stringify({ '9': { currency: 'EUR', country: 'ES' } })
    localStorage.setItem('project_settings', other)
    setAccessToken(operatorToken(2))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    expect(localStorage.getItem('project_settings')).toBe(other)
  })

  function impersonationOf(activeProject: Record<string, unknown>) {
    return {
      data: {
        success: true,
        message: '',
        data: {
          impersonation_token: jwt({ user_id: 7, is_impersonation: true, exp: FUTURE }),
          impersonated_user: {
            id: 5,
            username: 'target',
            email: '',
            first_name: 'T',
            last_name: 'U',
          },
          active_project: {
            project_id: 2,
            project_name: 'Madrid',
            role_id: 3,
            role_name: 'Operator',
            ...activeProject,
          },
          permissions: ['clients.view'],
        },
      },
    }
  }

  function adminMeInProject(currency: string, country: string) {
    const me = meFor(2)
    return {
      data: {
        ...me.data,
        active_project: { id: 2, name: 'Madrid', code: 'MAD', currency, country },
        projects: [me.data.projects[0]],
      },
    }
  }

  it('follows the target project when the admin is not a member of it', async () => {
    useAuthStore.setState({
      user: mapBackendUserToUser(meFor(1).data as never),
      isAuthenticated: true,
    })
    vi.mocked(authApi.impersonate).mockResolvedValue(
      impersonationOf({ currency: 'EUR', country: 'ES' }) as never
    )
    vi.mocked(authApi.me).mockResolvedValue(adminMeInProject('EUR', 'ES') as never)

    await useAuthStore.getState().startImpersonation(5)

    expect(activeCurrency()).toBe('EUR')
    expect(activeCountry()).toBe('ES')
  })

  it('keeps a Ukrainian target project in hryvnia', async () => {
    useAuthStore.setState({
      user: mapBackendUserToUser(meFor(1).data as never),
      isAuthenticated: true,
    })
    vi.mocked(authApi.impersonate).mockResolvedValue(
      impersonationOf({ currency: 'UAH', country: 'UA' }) as never
    )
    vi.mocked(authApi.me).mockResolvedValue(adminMeInProject('UAH', 'UA') as never)

    await useAuthStore.getState().startImpersonation(5)

    expect(activeCurrency()).toBe('UAH')
    expect(activeCountry()).toBe('UA')
  })

  it('reads the target project settings from the impersonation answer when /me fails', async () => {
    useAuthStore.setState({
      user: mapBackendUserToUser(meFor(1).data as never),
      isAuthenticated: true,
    })
    vi.mocked(authApi.impersonate).mockResolvedValue(
      impersonationOf({ currency: 'EUR', country: 'ES' }) as never
    )
    vi.mocked(authApi.me).mockRejectedValue(netErr)

    await useAuthStore.getState().startImpersonation(5)

    expect(activeCurrency()).toBe('EUR')
    expect(activeCountry()).toBe('ES')
  })
})
