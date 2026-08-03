/**
 * Tests for checkAuth()'s transient-failure handling (KAN-730).
 *
 * The fix: a transient error from /auth/validate (network / timeout / 5xx) must
 * KEEP the session (rebuild the user from the JWT), while a definitive 401 must
 * log out. It also restores timezone + impersonation context from localStorage,
 * since the JWT carries neither.
 *
 * Strategy: mock authApi.validate to throw the error under test, mock sonner
 * (the reconnecting toast), and drive checkAuth() against a hand-built JWT.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from 'sonner'

import { getAccessToken, setAccessToken } from '@/lib/api'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/stores/authStore'

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

// Build a base64url JWT payload that authStore.parseJwt can decode. btoa keeps
// the '=' padding, which parseJwt's atob handles after the -/_ → +// swap.
const b64url = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
const makeJwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`

const FUTURE = Math.floor(Date.now() / 1000) + 3600
const PAST = Math.floor(Date.now() / 1000) - 3600

const netErr = Object.assign(new Error('Network Error'), {
  isAxiosError: true,
  code: 'ERR_NETWORK',
})
const err401 = Object.assign(new Error('Unauthorized'), {
  isAxiosError: true,
  response: { status: 401 },
})

function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasCheckedAuth: false,
    isImpersonating: false,
    impersonatedUser: null,
    originalAdminUser: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetStore()
})

afterEach(() => {
  setAccessToken(null)
})

describe('checkAuth — transient auth failure keeps the session', () => {
  it('keeps the user logged in (rebuilt from the JWT) on a network error', async () => {
    setAccessToken(makeJwt({ user_id: 1, username: 'op', exp: FUTURE }))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(getAccessToken()).not.toBeNull()
    expect(s.user?.username).toBe('op')
    // and the sticky "reconnecting" toast is shown
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'auth-offline' })
    )
  })

  it('does NOT show the reconnecting toast on a definitive 401', async () => {
    setAccessToken(makeJwt({ user_id: 1, username: 'op', exp: FUTURE }))
    vi.mocked(authApi.validate).mockRejectedValue(err401)

    await useAuthStore.getState().checkAuth()

    expect(vi.mocked(toast.warning)).not.toHaveBeenCalled()
  })

  it('logs out on a definitive 401', async () => {
    setAccessToken(makeJwt({ user_id: 1, username: 'op', exp: FUTURE }))
    vi.mocked(authApi.validate).mockRejectedValue(err401)

    await useAuthStore.getState().checkAuth()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('logs out when the JWT is expired, even on a network error', async () => {
    setAccessToken(makeJwt({ user_id: 1, username: 'op', exp: PAST }))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('restores the timezone from the localStorage cache on a network error', async () => {
    localStorage.setItem('user_timezone', 'America/Chicago')
    setAccessToken(makeJwt({ user_id: 1, username: 'op', exp: FUTURE }))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user?.timezone).toBe('America/Chicago')
  })

  it('preserves impersonation context (banner stays) on a network error', async () => {
    localStorage.setItem(
      'impersonation_original_admin',
      JSON.stringify({ id: '9', username: 'admin' })
    )
    localStorage.setItem(
      'impersonated_user_profile',
      JSON.stringify({ id: '5', username: 'target' })
    )
    setAccessToken(makeJwt({ user_id: 5, username: 'target', is_impersonation: true, exp: FUTURE }))
    vi.mocked(authApi.validate).mockRejectedValue(netErr)

    await useAuthStore.getState().checkAuth()

    const s = useAuthStore.getState()
    expect(s.isImpersonating).toBe(true)
    expect(s.originalAdminUser?.username).toBe('admin')
    expect(s.impersonatedUser?.username).toBe('target')
  })
})
