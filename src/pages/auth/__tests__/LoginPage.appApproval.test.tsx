/**
 * Story 19-5 (Epic 19 FE-1): the CRM login page offers «Увійти через
 * підтвердження в Prionex» from `/config` only, and the 2FA step confirms on
 * the phone when `/login` lists `'app'`. The real store and `useAuth` run here;
 * only the network modules are stubbed, so «approved» is checked to sign the
 * person in the same way `/login` does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import type { LoginResponse } from '@/types/api'
import type { AppApprovalStart } from '@/features/appLogin/types'

vi.mock('react-i18next', async () =>
  (await import('@/features/appLogin/__tests__/appLoginI18nMock')).appLoginI18nMock()
)
// The i18n module is mocked globally; the language switch itself is not under test.
vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  applyPersistedLanguageFromServer: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/layout', () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('@/lib/sessionHeartbeat', () => ({
  scheduleSessionHeartbeat: vi.fn(),
  cancelSessionHeartbeat: vi.fn(),
}))

const approvalApi = vi.hoisted(() => ({
  config: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('@/features/appLogin/api/loginApprovalApi', () => ({
  loginApprovalApi: approvalApi,
  default: approvalApi,
}))

const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  forceLogin: vi.fn(),
  verifyTwoFactor: vi.fn(),
  me: vi.fn(),
  myProjects: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('@/features/auth/api/authApi', () => ({ authApi, default: authApi }))

const { default: LoginPage } = await import('../LoginPage')
const { useAuthStore } = await import('@/stores/authStore')
const { getAccessToken, setAccessToken } = await import('@/lib/api')

const b64url = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
const TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({
  user_id: 7,
  username: 'olena',
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.sig`

const CONFIG = { passwordless: true, second_factor: true, request_ttl: 120, poll_interval_ms: 2000 }
const SECRET = 'browser-secret-43-chars-xxxxxxxxxxxxxxxxxxx'
const STARTED: AppApprovalStart = {
  request_id: 'req-1',
  browser_secret: SECRET,
  number: 47,
  expires_in: 120,
  poll_interval_ms: 2000,
}
const PAIR = { request_id: 'req-1', browser_secret: SECRET }
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
  permissions: [],
  created_at: '2026-01-01T00:00:00Z',
}
const PENDING = { status: 'pending', expires_in: 100, login: null }

function http(status: number, detail: unknown): AxiosError {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data: { detail },
  })
}

/** Let promises settle and move the fake clock. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const entryButton = () =>
  screen.queryByRole('button', { name: /Sign in with confirmation in Prionex/ })

async function openPasswordless() {
  renderPage()
  await flush()
  fireEvent.click(entryButton()!)
  fireEvent.change(screen.getByLabelText(/^Username:/), { target: { value: 'olena' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send a request to my phone' }))
  await flush()
}

async function submitPassword() {
  fireEvent.change(screen.getByLabelText(/^Username or Email:/), { target: { value: 'olena' } })
  fireEvent.change(screen.getByLabelText(/^Password:/), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Login' }))
  await flush()
  await flush()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
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
  approvalApi.config.mockResolvedValue(CONFIG)
  approvalApi.start.mockResolvedValue(STARTED)
  approvalApi.poll.mockResolvedValue(PENDING)
  approvalApi.cancel.mockResolvedValue(undefined)
  authApi.me.mockResolvedValue({ data: ME })
})

afterEach(() => {
  vi.useRealTimers()
  setAccessToken(null)
})

describe('LoginPage — «Увійти через підтвердження в Prionex» (passwordless)', () => {
  it.each([
    ['404 (feature off)', () => approvalApi.config.mockRejectedValue(http(404, 'Not Found'))],
    [
      'a network error',
      () => approvalApi.config.mockRejectedValue(new AxiosError('x', 'ERR_NETWORK')),
    ],
    [
      'passwordless: false',
      () => approvalApi.config.mockResolvedValue({ ...CONFIG, passwordless: false }),
    ],
  ])('hides the button on %s', async (_case, arrange) => {
    arrange()
    renderPage()
    await flush()
    expect(approvalApi.config).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(entryButton()).not.toBeInTheDocument()
  })

  it('shows the button under the form when /config offers it', async () => {
    renderPage()
    await flush()
    expect(entryButton()).toBeInTheDocument()
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('approved: the number, the poll, then the same sign-in as /login', async () => {
    approvalApi.poll.mockResolvedValueOnce(PENDING).mockResolvedValueOnce({
      status: 'approved',
      login: LOGIN,
    })
    await openPasswordless()

    expect(approvalApi.start).toHaveBeenCalledWith({ username: 'olena', client: 'crm_web' })
    expect(screen.getByTestId('app-approval-number')).toHaveTextContent('47')
    expect(screen.getByText('The request is valid for another 2:00')).toBeInTheDocument()

    await flush(2000)
    expect(approvalApi.poll).toHaveBeenCalledWith(PAIR)
    expect(screen.getByText('The request is valid for another 1:58')).toBeInTheDocument()

    await flush(2000)
    await flush()
    expect(approvalApi.poll).toHaveBeenCalledTimes(2)
    expect(authApi.me).toHaveBeenCalled()
    expect(getAccessToken()).toBe(TOKEN)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('olena@example.com')

    // The browser secret stayed in memory: not in storage, not in the URL.
    const stored = [
      ...Object.keys(localStorage).map((key) => localStorage.getItem(key)),
      ...Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key)),
    ].join('|')
    expect(stored).not.toContain(SECRET)
    expect(window.location.href).not.toContain(SECRET)
  })

  it('denied: the design text, then back to the password form', async () => {
    approvalApi.poll.mockResolvedValueOnce({ status: 'denied', login: null })
    await openPasswordless()
    await flush(2000)

    expect(screen.getByRole('alert')).toHaveTextContent('The sign-in was declined on the phone.')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with password' }))
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('expired: «Надіслати ще раз» asks the phone again', async () => {
    approvalApi.poll.mockResolvedValueOnce({ status: 'expired', login: null })
    await openPasswordless()
    await flush(2000)

    expect(screen.getByRole('alert')).toHaveTextContent('The time to confirm has run out.')
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    await flush()
    expect(approvalApi.start).toHaveBeenCalledTimes(2)
    expect(approvalApi.start).toHaveBeenLastCalledWith({ username: 'olena', client: 'crm_web' })
    expect(screen.getByTestId('app-approval-number')).toBeInTheDocument()
  })

  it('«Скасувати» cancels on the server and returns to the login step with the login kept', async () => {
    await openPasswordless()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(approvalApi.cancel).toHaveBeenCalledWith(PAIR)
    expect(screen.getByLabelText(/^Username:/)).toHaveValue('olena')
    await flush(10_000)
    expect(approvalApi.poll).not.toHaveBeenCalled()
  })

  it('429 on start: «Забагато спроб» with the minutes', async () => {
    approvalApi.start.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_RATE_LIMITED', message: 'x', retry_after: 180 })
    )
    await openPasswordless()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 3 min or sign in with your password.'
    )
  })

  it('a generic failure never says whether the person exists', async () => {
    approvalApi.poll.mockRejectedValueOnce(
      http(404, { code: 'APP_LOGIN_REQUEST_NOT_FOUND', message: 'x' })
    )
    await openPasswordless()
    await flush(2000)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not confirm the sign-in. Sign in with your password.'
    )
  })

  it.each([
    ['IP_NOT_ALLOWED', 'Login Not Allowed From This Network'],
    ['ACCOUNT_LOCKED', 'Account Locked'],
  ])('a 403 %s on collection opens the existing card', async (code, heading) => {
    approvalApi.poll.mockRejectedValueOnce(http(403, { code, message: 'refused' }))
    await openPasswordless()
    await flush(2000)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('leaving the page stops the poll and cancels the waiting request', async () => {
    const { unmount } = renderPage()
    await flush()
    fireEvent.click(entryButton()!)
    fireEvent.change(screen.getByLabelText(/^Username:/), { target: { value: 'olena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a request to my phone' }))
    await flush()
    await flush(2000)
    expect(approvalApi.poll).toHaveBeenCalledTimes(1)

    unmount()
    expect(approvalApi.cancel).toHaveBeenCalledWith(PAIR)
    await flush(20_000)
    expect(approvalApi.poll).toHaveBeenCalledTimes(1)
  })
})

describe('LoginPage — the 2FA step confirms on the phone', () => {
  function twoFactor(methods?: string[]) {
    authApi.login.mockResolvedValue({
      data: {
        two_factor_required: true,
        two_factor_token: 'challenge',
        ...(methods ? { two_factor_methods: methods } : {}),
      },
    })
  }

  it("with 'app' the phone card is the default and approval signs in", async () => {
    twoFactor(['app', 'totp'])
    approvalApi.poll.mockResolvedValueOnce({ status: 'approved', login: LOGIN })
    renderPage()
    await flush()
    await submitPassword()

    expect(approvalApi.start).toHaveBeenCalledWith({
      two_factor_token: 'challenge',
      client: 'crm_web',
    })
    expect(screen.getByRole('heading')).toHaveTextContent('Confirm the sign-in on your phone')
    expect(screen.getByText('Signed in as olena')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Authentication code/)).not.toBeInTheDocument()

    await flush(2000)
    await flush()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(getAccessToken()).toBe(TOKEN)
  })

  it('«Ввести код з Google Authenticator» switches to TOTP and back to the phone', async () => {
    twoFactor(['app', 'totp'])
    renderPage()
    await flush()
    await submitPassword()

    fireEvent.click(screen.getByRole('button', { name: 'Enter the Google Authenticator code' }))
    expect(approvalApi.cancel).toHaveBeenCalledWith(PAIR)
    expect(screen.getByLabelText(/Authentication code/)).toBeInTheDocument()
    await flush(10_000)
    expect(approvalApi.poll).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm on my phone' }))
    await flush()
    expect(approvalApi.start).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('app-approval-number')).toBeInTheDocument()
  })

  it.each([
    ['only totp', ['totp']],
    ['no two_factor_methods (flag off)', undefined],
  ])(
    'without app (%s) the TOTP step is unchanged and the phone is never asked',
    async (_case, methods) => {
      twoFactor(methods)
      renderPage()
      await flush()
      await submitPassword()

      expect(screen.getByLabelText(/Authentication code/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirm on my phone' })).not.toBeInTheDocument()
      expect(approvalApi.start).not.toHaveBeenCalled()
    }
  )

  it('no phone any more (409 APP_LOGIN_NOT_ENABLED) falls back to the TOTP code', async () => {
    twoFactor(['app', 'totp'])
    approvalApi.start.mockRejectedValueOnce(
      http(409, { code: 'APP_LOGIN_NOT_ENABLED', message: 'no phone' })
    )
    renderPage()
    await flush()
    await submitPassword()

    expect(screen.getByLabelText(/Authentication code/)).toBeInTheDocument()
  })

  it('a dead challenge (TOTP used meanwhile) returns to the password form', async () => {
    twoFactor(['app', 'totp'])
    approvalApi.poll.mockRejectedValueOnce(
      http(401, { code: 'TWO_FACTOR_CHALLENGE_EXPIRED', message: 'Challenge expired' })
    )
    renderPage()
    await flush()
    await submitPassword()
    await flush(2000)

    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByText('Challenge expired')).toBeInTheDocument()
    expect(useAuthStore.getState().twoFactorToken).toBeNull()
  })
})
