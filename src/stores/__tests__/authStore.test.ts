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

/**
 * exitImpersonation's teardown boundary (KAN-941).
 *
 * Exit is the one call whose failure can strand the SPA inside impersonation:
 * api.ts's 401 interceptor skips /auth/* URLs, so nothing else will clear the
 * session. The backend terminates and blacklists the admin session on every
 * refusal past its is_impersonation check and answers 401 for all of them.
 *
 * The risky part is the boundary, so that is what these pin: a 401 (and a 2xx
 * whose payload is unusable) must tear the session down, while a 400, a 5xx and
 * a network error must leave a still-valid session alone. Getting that backwards
 * logs an admin out on a gateway blip, and this call gets no retries at all —
 * shouldRetryTransient bails on /auth/ URLs and on non-GET methods.
 */
describe('exitImpersonation — only a definitive rejection tears the session down', () => {
  // triggerAuthExpired hard-navigates; jsdom cannot, so swap location for a
  // plain object. That also makes the redirect itself assertable.
  const realLocation = window.location
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...realLocation, href: '' },
    })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  const IMPERSONATION_JWT = () =>
    makeJwt({ user_id: 5, username: 'target', is_impersonation: true, exp: FUTURE })

  const err = (status: number) =>
    Object.assign(new Error(`HTTP ${status}`), {
      isAxiosError: true,
      response: { status, data: { detail: { code: 'X', message: 'nope' } } },
    })

  function arrangeImpersonating() {
    localStorage.setItem(
      'impersonation_original_admin',
      JSON.stringify({ id: '9', username: 'admin' })
    )
    localStorage.setItem(
      'impersonated_user_profile',
      JSON.stringify({ id: '5', username: 'target' })
    )
    setAccessToken(IMPERSONATION_JWT())
    useAuthStore.setState({ isImpersonating: true })
  }

  const expectSessionKept = () => {
    expect(getAccessToken()).not.toBeNull()
    expect(localStorage.getItem('impersonation_original_admin')).not.toBeNull()
    expect(localStorage.getItem('impersonated_user_profile')).not.toBeNull()
    expect(window.location.href).toBe('')
  }

  const expectSessionTornDown = () => {
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('impersonation_original_admin')).toBeNull()
    expect(localStorage.getItem('impersonated_user_profile')).toBeNull()
    expect(useAuthStore.getState().isImpersonating).toBe(false)
    expect(window.location.href).toBe('/login')
  }

  it('tears down on a 401 - the server rejected the token', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockRejectedValue(err(401))

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionTornDown()
  })

  it('tears down on a 2xx whose payload has no admin token', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockResolvedValue({
      data: { success: true, data: {} },
    } as never)

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionTornDown()
  })

  it('keeps the session on a 400 - the caller was simply not impersonating', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockRejectedValue(err(400))

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionKept()
  })

  it('keeps the session on a 503 - the request never reached the handler', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockRejectedValue(err(503))

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionKept()
  })

  it('keeps the session on a 429 - the rate limiter rejects before any session logic', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockRejectedValue(err(429))

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionKept()
  })

  it('keeps the session on a network error', async () => {
    arrangeImpersonating()
    vi.mocked(authApi.exitImpersonation).mockRejectedValue(netErr)

    await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow()

    expectSessionKept()
  })
})
