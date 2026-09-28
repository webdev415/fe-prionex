/**
 * Story 19.17 (board #1580): the «QR-код» tab of the CRM login page. It exists
 * only while `/config` answers `qr: true`; opening it asks for a QR, the poll
 * follows the phone (`scanned` → `approved`), and an approval signs the person
 * in exactly as `/login` does. The real store and `useAuth` run here; only the
 * network modules are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import type { LoginResponse } from '@/types/api'
import type { AppApprovalQrStart } from '@/features/appLogin/types'

vi.mock('react-i18next', async () =>
  (await import('@/features/appLogin/__tests__/appLoginI18nMock')).appLoginI18nMock()
)
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
  startQr: vi.fn(),
  refreshQr: vi.fn(),
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

const CONFIG = {
  passwordless: false,
  second_factor: false,
  request_ttl: 120,
  poll_interval_ms: 2000,
  qr: true,
}
const SECRET = 'browser-secret-43-chars-yyyyyyyyyyyyyyyyyyy'
const QR_SECRET = 'QrSecret43charsZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'
const PAYLOAD = `prionex-app-login-qr/v1|dev|ReqId22charsXXXXXXXXXX|${QR_SECRET}`
const QR_STARTED: AppApprovalQrStart = {
  request_id: 'ReqId22charsXXXXXXXXXX',
  browser_secret: SECRET,
  qr_payload: PAYLOAD,
  qr_expires_in: 60,
  qr_refresh_in: 30,
  expires_in: 120,
  poll_interval_ms: 2000,
}
const PAIR = { request_id: 'ReqId22charsXXXXXXXXXX', browser_secret: SECRET }
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
const SCANNED = { status: 'scanned', expires_in: 120, login: null }

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

const qrTab = () => screen.queryByRole('tab', { name: 'QR code' })
const passwordTab = () => screen.getByRole('tab', { name: 'Password' })

async function openQrTab() {
  renderPage()
  await flush()
  fireEvent.click(qrTab()!)
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
  approvalApi.startQr.mockResolvedValue(QR_STARTED)
  approvalApi.refreshQr.mockResolvedValue({
    qr_payload: `${PAYLOAD.slice(0, -1)}Y`,
    qr_expires_in: 60,
    qr_refresh_in: 30,
  })
  approvalApi.poll.mockResolvedValue(PENDING)
  approvalApi.cancel.mockResolvedValue(undefined)
  authApi.me.mockResolvedValue({ data: ME })
})

afterEach(() => {
  vi.useRealTimers()
  setAccessToken(null)
})

describe('LoginPage — «QR-код» tab (story 19.17)', () => {
  it.each([
    [
      'no qr key (mode off)',
      () => approvalApi.config.mockResolvedValue({ ...CONFIG, qr: undefined }),
    ],
    ['qr: false', () => approvalApi.config.mockResolvedValue({ ...CONFIG, qr: false })],
    ['404 (feature off)', () => approvalApi.config.mockRejectedValue(http(404, 'Not Found'))],
  ])('shows no tabs on %s — the password form as before', async (_case, arrange) => {
    arrange()
    renderPage()
    await flush()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(qrTab()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('qr: true — the tab sits next to the password form and asks for nothing until opened', async () => {
    renderPage()
    await flush()
    expect(screen.getByRole('tablist', { name: 'Sign-in method' })).toBeInTheDocument()
    expect(passwordTab()).toHaveAttribute('aria-selected', 'true')
    expect(qrTab()).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    await flush(10_000)
    expect(approvalApi.startQr).not.toHaveBeenCalled()
  })

  it('opening the tab draws the QR, then scanned → approved signs in like /login', async () => {
    approvalApi.poll
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce(SCANNED)
      .mockResolvedValueOnce({ status: 'approved', login: LOGIN })
    await openQrTab()

    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)
    expect(approvalApi.startQr).toHaveBeenCalledWith({ client: 'crm_web' })
    expect(qrTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('img', { name: 'QR code for signing in to CRM' })).toBeInTheDocument()
    expect(screen.getByText('Scan the code in the HUB app → Security')).toBeInTheDocument()
    expect(screen.getByText('The request is valid for another 2:00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument()

    await flush(2000)
    expect(approvalApi.poll).toHaveBeenCalledWith(PAIR)
    await flush(2000)
    expect(screen.getByRole('heading')).toHaveTextContent('Confirm the sign-in on your phone')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await flush(2000)
    await flush()
    expect(authApi.me).toHaveBeenCalled()
    expect(getAccessToken()).toBe(TOKEN)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('olena@example.com')

    const stored = [
      ...Object.keys(localStorage).map((key) => localStorage.getItem(key)),
      ...Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key)),
    ].join('|')
    expect(stored).not.toContain(SECRET)
    expect(stored).not.toContain(QR_SECRET)
    expect(window.location.href).not.toContain(QR_SECRET)
  })

  it('rotates the QR every 30 s while nobody scans it', async () => {
    await openQrTab()
    const before = screen.getByRole('img').querySelector('path')?.getAttribute('d')
    await flush(30_000)
    expect(approvalApi.refreshQr).toHaveBeenCalledWith(PAIR)
    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(before)
  })

  it('back to «Пароль» cancels the QR request and stops the poll', async () => {
    await openQrTab()
    fireEvent.click(passwordTab())
    expect(approvalApi.cancel).toHaveBeenCalledWith(PAIR)
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    await flush(60_000)
    expect(approvalApi.poll).not.toHaveBeenCalled()
    expect(approvalApi.refreshQr).not.toHaveBeenCalled()
  })

  it('Password/QR/Password/QR at speed: one /qr per 5 s, however the tab is reopened', async () => {
    await openQrTab()
    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 3; i++) {
      fireEvent.click(passwordTab())
      fireEvent.click(qrTab()!)
      await flush()
    }
    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)
    // Each departure retired the code on the server; the tab waits instead of asking again.
    expect(approvalApi.cancel).toHaveBeenCalledTimes(1)
    expect(qrTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Preparing the QR code…')

    // The 5 s since the first request are over: the open tab asks once, by itself.
    await flush(5000)
    expect(approvalApi.startQr).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'QR code for signing in to CRM' })).toBeInTheDocument()
  })

  it('leaving the tab while it waits for the 5 s asks for nothing', async () => {
    await openQrTab()
    fireEvent.click(passwordTab())
    fireEvent.click(qrTab()!)
    fireEvent.click(passwordTab())
    await flush(30_000)
    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('429 on /qr: the tab keeps the wait across a switch, and «Новий код» only after it', async () => {
    approvalApi.startQr.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_RATE_LIMITED', message: 'x', retry_after: 240 })
    )
    await openQrTab()
    const text =
      'Too many QR codes from this network. Try again in 4 min or sign in with your password.'
    expect(screen.getByRole('alert')).toHaveTextContent(text)

    await flush(10_000)
    fireEvent.click(passwordTab())
    fireEvent.click(qrTab()!)
    await flush()
    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('button', { name: 'New code' })).toBeDisabled()

    await flush(229_000)
    expect(screen.getByRole('button', { name: 'New code' })).toBeDisabled()
    await flush(2000)
    expect(screen.getByRole('button', { name: 'New code' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'New code' }))
    await flush()
    expect(approvalApi.startQr).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'QR code for signing in to CRM' })).toBeInTheDocument()
  })

  it('denied: a clear text, and «Новий код» asks for a new QR no sooner than 5 s', async () => {
    approvalApi.poll.mockResolvedValueOnce({ status: 'denied', login: null })
    await openQrTab()
    await flush(2000)

    expect(screen.getByRole('alert')).toHaveTextContent('The sign-in was declined on the phone.')
    const newCode = screen.getByRole('button', { name: 'New code' })
    expect(newCode).toBeDisabled() // 2 s since the tab opened the request
    await flush(3000)
    fireEvent.click(screen.getByRole('button', { name: 'New code' }))
    await flush()
    expect(approvalApi.startQr).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'QR code for signing in to CRM' })).toBeInTheDocument()
  })

  it('expired: its own text and «Новий код»', async () => {
    approvalApi.poll.mockResolvedValue({ status: 'pending', expires_in: null, login: null })
    await openQrTab()
    await flush(123_000)
    expect(screen.getByRole('alert')).toHaveTextContent('The QR code has expired.')
    expect(screen.getByRole('button', { name: 'New code' })).toBeEnabled()
  })

  it('a network error keeps the tab usable with «Спробувати ще раз» — no retry loop', async () => {
    approvalApi.startQr.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
    await openQrTab()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not get a QR code. Check the connection and try again.'
    )
    await flush(30_000)
    expect(approvalApi.startQr).toHaveBeenCalledTimes(1)
    expect(approvalApi.poll).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await flush()
    expect(approvalApi.startQr).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('a 5xx on /qr shows the same retry', async () => {
    approvalApi.startQr.mockRejectedValueOnce(
      http(503, { code: 'APP_LOGIN_UNAVAILABLE', message: 'x' })
    )
    await openQrTab()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('the stand switched the mode off (404 on /qr): back to the password form, no tab', async () => {
    approvalApi.startQr.mockRejectedValueOnce(http(404, 'Not Found'))
    await openQrTab()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('a 403 IP_NOT_ALLOWED on collection opens the existing card; back returns to «Пароль»', async () => {
    approvalApi.poll
      .mockResolvedValueOnce(SCANNED)
      .mockRejectedValueOnce(http(403, { code: 'IP_NOT_ALLOWED', message: 'refused' }))
    await openQrTab()
    await flush(4000)

    expect(
      screen.getByRole('heading', { name: 'Login Not Allowed From This Network' })
    ).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    act(() => useAuthStore.getState().clearError())
    expect(passwordTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('leaving the page cancels the QR request and ends its timers', async () => {
    const { unmount } = renderPage()
    await flush()
    fireEvent.click(qrTab()!)
    await flush()

    unmount()
    expect(approvalApi.cancel).toHaveBeenCalledWith(PAIR)
    await flush(60_000)
    expect(approvalApi.poll).not.toHaveBeenCalled()
    expect(approvalApi.refreshQr).not.toHaveBeenCalled()
  })
})
