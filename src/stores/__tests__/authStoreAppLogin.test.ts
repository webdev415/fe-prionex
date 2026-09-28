/**
 * The store side of the phone-confirmed sign-in (Epic 19, story 19-5): the
 * `LoginResponse` a poll collects is persisted exactly like a `/login` one, and
 * its refusals land on the same login-screen states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAccessToken, setAccessToken } from '@/lib/api'
import { authApi } from '@/features/auth/api/authApi'
import { cancelSessionHeartbeat, scheduleSessionHeartbeat } from '@/lib/sessionHeartbeat'
import { buildUserFromJwtToken } from '@/lib/mapBackendUser'
import { useAuthStore } from '@/stores/authStore'
import type { LoginResponse } from '@/types/api'

// The i18n module is mocked globally; the language switch itself is not under test.
vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  applyPersistedLanguageFromServer: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/lib/sessionHeartbeat', () => ({
  scheduleSessionHeartbeat: vi.fn(),
  cancelSessionHeartbeat: vi.fn(),
}))
vi.mock('@/lib/mapBackendUser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mapBackendUser')>()
  return { ...actual, buildUserFromJwtToken: vi.fn(actual.buildUserFromJwtToken) }
})
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: {
    me: vi.fn(),
    myProjects: vi.fn(),
    login: vi.fn(),
    forceLogin: vi.fn(),
    logout: vi.fn(),
  },
}))

const b64url = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
const makeJwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`

const TOKEN = makeJwt({
  user_id: 7,
  username: 'olena',
  exp: Math.floor(Date.now() / 1000) + 3600,
})
const LOGIN: LoginResponse = {
  token: TOKEN,
  user: { id: 7, username: 'olena' } as unknown as LoginResponse['user'],
}
const ME = {
  id: 7,
  username: 'olena',
  email: 'olena@example.com',
  first_name: 'Olena',
  last_name: 'K',
  permissions: ['view_clients'],
  created_at: '2026-01-01T00:00:00Z',
}

function http(status: number, detail: unknown) {
  return Object.assign(new Error('fail'), {
    isAxiosError: true,
    response: { status, data: { detail } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    errorState: null,
    lockoutMinutes: null,
    pendingCredentials: null,
    hasCheckedAuth: false,
    twoFactorToken: null,
    twoFactorUsername: null,
    twoFactorMethods: null,
  })
})

afterEach(() => {
  setAccessToken(null)
})

describe('two_factor_methods of the /login challenge', () => {
  it('keeps the methods so the 2FA step can offer the phone', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        two_factor_required: true,
        two_factor_token: 'challenge',
        two_factor_methods: ['app', 'totp'],
      },
    } as never)

    await useAuthStore.getState().login({ username: 'olena', password: 'password123' })

    const s = useAuthStore.getState()
    expect(s.errorState).toBe('TWO_FACTOR_REQUIRED')
    expect(s.twoFactorToken).toBe('challenge')
    expect(s.twoFactorMethods).toEqual(['app', 'totp'])
  })

  it('is null when the stand does not send the key (old answer)', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { two_factor_required: true, two_factor_token: 'challenge' },
    } as never)

    await useAuthStore.getState().login({ username: 'olena', password: 'password123' })
    expect(useAuthStore.getState().twoFactorMethods).toBeNull()
  })

  it('is cleared with the challenge', () => {
    useAuthStore.setState({
      twoFactorToken: 'challenge',
      twoFactorMethods: ['app', 'totp'],
      errorState: 'TWO_FACTOR_REQUIRED',
    })
    useAuthStore.getState().cancelTwoFactor()
    expect(useAuthStore.getState().twoFactorMethods).toBeNull()
  })
})

describe('completeAppLogin', () => {
  it('persists the approved login exactly like /login: token, heartbeat, /users/me', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ data: ME } as never)
    useAuthStore.setState({
      twoFactorToken: 'challenge',
      twoFactorUsername: 'olena',
      twoFactorMethods: ['app', 'totp'],
      errorState: 'TWO_FACTOR_REQUIRED',
    })

    await useAuthStore.getState().completeAppLogin(LOGIN)

    const s = useAuthStore.getState()
    expect(getAccessToken()).toBe(TOKEN)
    expect(scheduleSessionHeartbeat).toHaveBeenCalledTimes(1)
    expect(s.isAuthenticated).toBe(true)
    expect(s.hasCheckedAuth).toBe(true)
    expect(s.user?.username).toBe('olena')
    expect(s.user?.permissions).toEqual(['view_clients'])
    expect(s.errorState).toBeNull()
    expect(s.twoFactorToken).toBeNull()
    expect(s.twoFactorMethods).toBeNull()
  })

  it('falls back to the JWT when /users/me fails, like /login', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('down'))
    vi.mocked(authApi.myProjects).mockRejectedValue(new Error('down'))

    await useAuthStore.getState().completeAppLogin(LOGIN)

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.user?.username).toBe('olena')
    expect(s.user?.email).toBeUndefined()
  })

  it('leaves no half-signed-in state when the profile cannot be built', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('down'))
    vi.mocked(buildUserFromJwtToken).mockImplementationOnce(() => {
      throw new Error('bad token')
    })

    await expect(useAuthStore.getState().completeAppLogin(LOGIN)).rejects.toThrow('bad token')

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.isLoading).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(cancelSessionHeartbeat).toHaveBeenCalled()
  })

  it('refuses a response without a token and signs nobody in', async () => {
    await expect(useAuthStore.getState().completeAppLogin({ user: LOGIN.user })).rejects.toThrow()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })
})

describe('failAppLogin', () => {
  it.each([
    ['ACCOUNT_LOCKED', 'ACCOUNT_LOCKED'],
    ['IP_NOT_ALLOWED', 'IP_NOT_ALLOWED'],
    ['ACCOUNT_INACTIVE', 'INVALID_CREDENTIALS'],
    ['NO_PROJECT_ASSIGNED', null],
    ['TWO_FACTOR_CHALLENGE_EXPIRED', null],
  ])('%s → %s, with the message and the challenge dropped', (code, state) => {
    useAuthStore.setState({
      twoFactorToken: 'challenge',
      twoFactorMethods: ['app', 'totp'],
      errorState: 'TWO_FACTOR_REQUIRED',
    })

    useAuthStore.getState().failAppLogin({ code, message: `refused: ${code}`, lockoutMinutes: 9 })

    const s = useAuthStore.getState()
    expect(s.errorState).toBe(state)
    expect(s.error).toBe(`refused: ${code}`)
    expect(s.lockoutMinutes).toBe(9)
    expect(s.twoFactorToken).toBeNull()
    expect(s.twoFactorMethods).toBeNull()
    expect(s.isAuthenticated).toBe(false)
  })
})

describe('/login refusal mapping (shared with the phone sign-in, unchanged)', () => {
  it.each([
    ['INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'],
    ['ACCOUNT_INACTIVE', 'INVALID_CREDENTIALS'],
    ['ACCOUNT_LOCKED', 'ACCOUNT_LOCKED'],
    ['IP_NOT_ALLOWED', 'IP_NOT_ALLOWED'],
    ['NO_PROJECT_ASSIGNED', null],
  ])('%s → %s', async (code, state) => {
    vi.mocked(authApi.login).mockRejectedValue(http(403, { code, message: 'no' }))
    await expect(
      useAuthStore.getState().login({ username: 'olena', password: 'password123' })
    ).rejects.toBeTruthy()
    expect(useAuthStore.getState().errorState).toBe(state)
    expect(useAuthStore.getState().pendingCredentials).toBeNull()
  })

  it('ALREADY_LOGGED_IN keeps the credentials for the force login', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      http(409, { code: 'ALREADY_LOGGED_IN', message: 'elsewhere' })
    )
    await expect(
      useAuthStore.getState().login({ username: 'olena', password: 'password123' })
    ).rejects.toBeTruthy()
    expect(useAuthStore.getState().errorState).toBe('ALREADY_LOGGED_IN')
    expect(useAuthStore.getState().pendingCredentials).toEqual({
      username: 'olena',
      password: 'password123',
    })
  })
})
