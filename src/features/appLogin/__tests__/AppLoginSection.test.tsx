import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AppLoginDevice, AppLoginStatus } from '../types'

vi.mock('react-i18next', async () => (await import('./appLoginI18nMock')).appLoginI18nMock())

const statusMock = vi.fn()
const enableMutate = vi.fn()
const disableMutate = vi.fn()
const revokeMutate = vi.fn()
const invalidateStatus = vi.fn()
const twoFactorMock = vi.fn()
const auth = vi.hoisted(() => ({ isImpersonating: false }))

vi.mock('../hooks/useAppLogin', () => ({
  useMyAppLoginStatus: (...args: unknown[]) => statusMock(...args),
  useInvalidateMyAppLoginStatus: () => invalidateStatus,
  useEnableAppLogin: () => ({ mutateAsync: enableMutate, isPending: false }),
  useDisableAppLogin: () => ({ mutateAsync: disableMutate, isPending: false }),
  useRevokeMyAppLoginDevice: () => ({ mutateAsync: revokeMutate, isPending: false }),
}))
vi.mock('@/features/auth/hooks/useTwoFactor', () => ({
  useTwoFactorStatus: (...args: unknown[]) => twoFactorMock(...args),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { toast } = await import('sonner')
const { AppLoginSection } = await import('../components/AppLoginSection')

const IPHONE: AppLoginDevice = {
  id: 'dev-1',
  label: 'iPhone 15',
  platform: 'ios',
  created_at: '2026-09-25T10:00:00Z',
  last_used_at: '2026-09-26T12:20:00Z',
}

function loaded(data: AppLoginStatus) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }
}

function failed(error: unknown, extra: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    error,
    isFetching: false,
    refetch: vi.fn(),
    ...extra,
  }
}

function http(status: number, detail: unknown = 'Invalid password'): AxiosError {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data: { detail },
  })
}

const OFF: AppLoginStatus = { feature_available: true, enabled: false, devices: [], max_devices: 3 }

async function openEnableAndSubmit(password = 'secret') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Bind a phone' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Password'), password)
  await user.click(within(dialog).getByRole('button', { name: 'Get a code for the phone' }))
  return { user, dialog }
}

describe('AppLoginSection', () => {
  beforeEach(() => {
    statusMock.mockReset()
    enableMutate.mockReset()
    disableMutate.mockReset()
    revokeMutate.mockReset()
    invalidateStatus.mockReset()
    twoFactorMock.mockReset()
    twoFactorMock.mockReturnValue({ data: { enabled: false, backup_codes_remaining: 0 } })
    vi.mocked(toast.success).mockReset()
    auth.isImpersonating = false
  })

  describe('hidden while the feature is off', () => {
    it('renders nothing when the API says feature_available=false', () => {
      statusMock.mockReturnValue(loaded({ feature_available: false }))
      const { container } = render(<AppLoginSection />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the routes answer 404 (flag off)', () => {
      statusMock.mockReturnValue(failed(http(404)))
      const { container } = render(<AppLoginSection />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the flag goes off mid-session (a 404 after an answer)', () => {
      statusMock.mockReturnValue({ ...loaded(OFF), isError: true, error: http(404) })
      const { container } = render(<AppLoginSection />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing while loading (no flash of a feature that may be off)', () => {
      statusMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null })
      const { container } = render(<AppLoginSection />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('the status read failed for another reason', () => {
    it.each([
      ['a 503', http(503, 'Service Unavailable')],
      ['a network failure', new Error('Network Error')],
    ])('%s: an error line and a retry instead of a silent gap', async (_case, error) => {
      const refetch = vi.fn()
      statusMock.mockReturnValue(failed(error, { refetch }))
      const user = userEvent.setup()
      const { rerender } = render(<AppLoginSection />)

      expect(screen.getByTestId('app-login-section')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load the phone binding status.'
      )
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(refetch).toHaveBeenCalledTimes(1)

      // The re-read answered: the section is back to its normal self.
      statusMock.mockReturnValue(loaded(OFF))
      rerender(<AppLoginSection />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bind a phone' })).toBeInTheDocument()
    })

    it('the retry button is busy while the re-read runs', () => {
      statusMock.mockReturnValue(failed(http(503), { isFetching: true }))
      render(<AppLoginSection />)
      // A loading button reads «Loading...», so it is found by place, not by name.
      expect(within(screen.getByTestId('app-login-section')).getByRole('button')).toBeDisabled()
    })

    it('a failed poll keeps the last answer on screen', () => {
      statusMock.mockReturnValue({ ...loaded(OFF), isError: true, error: http(503) })
      render(<AppLoginSection />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bind a phone' })).toBeInTheDocument()
    })
  })

  describe('acting as another user', () => {
    beforeEach(() => {
      auth.isImpersonating = true
    })

    it('bound: the state and the phones are shown, but no toggle, bind or unbind', () => {
      statusMock.mockReturnValue(
        loaded({ feature_available: true, enabled: true, devices: [IPHONE], max_devices: 3 })
      )
      render(<AppLoginSection />)

      expect(screen.getByText('Enabled')).toBeInTheDocument()
      expect(screen.getByTestId('app-login-device')).toHaveTextContent('iPhone 15')
      expect(screen.getByTestId('app-login-read-only')).toHaveTextContent(
        /While acting as another user/
      )
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Unbind' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bind another phone' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bind a phone' })).not.toBeInTheDocument()
    })

    it('nothing bound: no «Bind a phone» either, only the explanation', () => {
      statusMock.mockReturnValue(loaded(OFF))
      render(<AppLoginSection />)

      expect(screen.getByText('Disabled')).toBeInTheDocument()
      expect(screen.getByTestId('app-login-read-only')).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bind a phone' })).not.toBeInTheDocument()
    })

    it('control: the same person in their own account gets the controls', () => {
      auth.isImpersonating = false
      statusMock.mockReturnValue(loaded(OFF))
      render(<AppLoginSection />)

      expect(screen.queryByTestId('app-login-read-only')).not.toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bind a phone' })).toBeInTheDocument()
    })
  })

  it('off state: title, disabled badge, toggle off and the bind button', () => {
    statusMock.mockReturnValue(loaded(OFF))
    render(<AppLoginSection />)

    expect(screen.getByText('Sign-in through the mobile app')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Allow sign-in through the mobile app' })
    ).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Bind a phone' })).toBeInTheDocument()
  })

  it('polls only while a pairing code is on screen', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    render(<AppLoginSection />)

    expect(statusMock).toHaveBeenLastCalledWith({ pollMs: false })
    const before = Date.now()
    await openEnableAndSubmit()
    expect(statusMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ pollMs: 3000, pollUntil: expect.any(Number) })
    )
    // The poll stops by itself one tick after the code's TTL (300 s here).
    const { pollUntil } = statusMock.mock.calls.at(-1)?.[0] as { pollUntil: number }
    expect(pollUntil).toBeGreaterThanOrEqual(before + 303_000)
    expect(pollUntil).toBeLessThanOrEqual(Date.now() + 303_000)
  })

  it.each([
    ['missing', undefined],
    ['not a number', 'soon'],
  ])(
    'expires_in %s: the design lifetime (5 min) drives the countdown and the poll',
    async (_case, expiresIn) => {
      statusMock.mockReturnValue(loaded(OFF))
      enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: expiresIn })
      render(<AppLoginSection />)

      const before = Date.now()
      await openEnableAndSubmit()

      expect(await screen.findByText(/Code valid for [45]:\d\d/)).toBeInTheDocument()
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
      const { pollMs, pollUntil } = statusMock.mock.calls.at(-1)?.[0] as {
        pollMs: number
        pollUntil: number
      }
      expect(pollMs).toBe(3000)
      expect(pollUntil).toBeGreaterThanOrEqual(before + 303_000)
      expect(pollUntil).toBeLessThanOrEqual(Date.now() + 303_000)
    }
  )

  it('promises «from any network» only when the stand skips the IP whitelist', () => {
    statusMock.mockReturnValue(loaded({ ...OFF, device_ip_bypass: false }))
    const { unmount } = render(<AppLoginSection />)
    expect(screen.getByText(/still follows the IP address restriction/)).toBeInTheDocument()
    expect(screen.queryByText(/from any network/)).not.toBeInTheDocument()
    unmount()

    statusMock.mockReturnValue(loaded({ ...OFF, device_ip_bypass: true }))
    render(<AppLoginSection />)
    expect(screen.getByText(/from any network/)).toBeInTheDocument()
  })

  it('password accepted: grouped code, QR, countdown and the waiting line', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({
      pairing_code: 'ABCDEFGH',
      pairing_url: 'prionexhub://app-login/pair?c=ABCDEFGH&e=crm.dev.crm-prionex.online',
      expires_in: 300,
      pairing_qr_png_base64: 'iVBORw0KGgo=',
    })
    render(<AppLoginSection />)

    await openEnableAndSubmit('secret')

    expect(enableMutate).toHaveBeenCalledWith({ password: 'secret' })
    expect(await screen.findByTestId('app-login-pairing-code')).toHaveTextContent('ABCD-EFGH')
    expect(screen.getByAltText('QR code for binding the phone')).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo='
    )
    expect(screen.getByText(/Code valid for [45]:\d\d/)).toBeInTheDocument()
    expect(screen.getByText('Waiting for the phone…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open in Prionex Hub/ })).toHaveAttribute(
      'href',
      'prionexhub://app-login/pair?c=ABCDEFGH&e=crm.dev.crm-prionex.online'
    )
    // While the code is up the toggle reads as on.
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('no pairing_url from the API: the code alone, no guessed link and no QR', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCD-EFGH', expires_in: 300 })
    render(<AppLoginSection />)

    await openEnableAndSubmit()

    expect(await screen.findByTestId('app-login-pairing-code')).toHaveTextContent('ABCD-EFGH')
    expect(screen.queryByAltText('QR code for binding the phone')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open in Prionex Hub/ })).not.toBeInTheDocument()
  })

  it('a pairing_url that is not the phone deep link never reaches an href', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({
      pairing_code: 'ABCD-EFGH',
      pairing_url: 'javascript:alert(1)',
      expires_in: 300,
    })
    render(<AppLoginSection />)

    await openEnableAndSubmit()

    expect(await screen.findByTestId('app-login-pairing-code')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open in Prionex Hub/ })).not.toBeInTheDocument()
  })

  it('wrong password: the refusal stays in the modal and no code appears', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockRejectedValue(http(401, 'Invalid password'))
    render(<AppLoginSection />)

    const { dialog } = await openEnableAndSubmit('wrong')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Invalid password')
    expect(screen.queryByTestId('app-login-pairing-code')).not.toBeInTheDocument()
  })

  it('the API refusal {detail: {code: INVALID_CREDENTIALS}} is shown localized', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockRejectedValue(
      http(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid password' })
    )
    render(<AppLoginSection />)

    const { dialog } = await openEnableAndSubmit('wrong')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wrong password or code')
  })

  it('TWO_FACTOR_CODE_REQUIRED reveals the code field (stale 2FA status)', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockRejectedValueOnce(
      http(401, { code: 'TWO_FACTOR_CODE_REQUIRED', message: 'Enter the code.' })
    )
    enableMutate.mockResolvedValueOnce({ pairing_code: 'ABCD-EFGH', expires_in: 300 })
    render(<AppLoginSection />)

    const { user, dialog } = await openEnableAndSubmit('secret')
    expect(await within(dialog).findByLabelText('Google Authenticator code')).toBeInTheDocument()

    // The password stays typed; only the code is added.
    await user.type(within(dialog).getByLabelText('Google Authenticator code'), '123456')
    await user.click(within(dialog).getByRole('button', { name: 'Get a code for the phone' }))
    expect(enableMutate).toHaveBeenLastCalledWith({ password: 'secret', code: '123456' })
  })

  it('asks for the Google Authenticator code when 2FA is on and sends it', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    twoFactorMock.mockReturnValue({ data: { enabled: true, backup_codes_remaining: 5 } })
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    const user = userEvent.setup()
    render(<AppLoginSection />)

    await user.click(screen.getByRole('button', { name: 'Bind a phone' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Password'), 'secret')
    await user.click(within(dialog).getByRole('button', { name: 'Get a code for the phone' }))
    expect(
      await within(dialog).findByText('Enter the Google Authenticator code')
    ).toBeInTheDocument()
    expect(enableMutate).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Google Authenticator code'), '123456')
    await user.click(within(dialog).getByRole('button', { name: 'Get a code for the phone' }))
    expect(enableMutate).toHaveBeenCalledWith({ password: 'secret', code: '123456' })
  })

  it('an empty password is refused before any request', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    const user = userEvent.setup()
    render(<AppLoginSection />)

    await user.click(screen.getByRole('button', { name: 'Bind a phone' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Get a code for the phone' }))

    expect(await within(dialog).findByText('Enter your password')).toBeInTheDocument()
    expect(enableMutate).not.toHaveBeenCalled()
  })

  it('the phone enrolls: the poll brings a new device, shown as connected', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    const { rerender } = render(<AppLoginSection />)
    await openEnableAndSubmit()
    await screen.findByTestId('app-login-pairing-code')

    statusMock.mockReturnValue(
      loaded({ feature_available: true, enabled: true, devices: [IPHONE], max_devices: 3 })
    )
    rerender(<AppLoginSection />)

    expect(await screen.findByText('iPhone 15 connected')).toBeInTheDocument()
    expect(screen.queryByTestId('app-login-pairing-code')).not.toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(statusMock).toHaveBeenLastCalledWith({ pollMs: false })
  })

  it('a phone that reported no name is announced as «Phone»', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    const { rerender } = render(<AppLoginSection />)
    await openEnableAndSubmit()
    await screen.findByTestId('app-login-pairing-code')

    statusMock.mockReturnValue(
      loaded({
        feature_available: true,
        enabled: true,
        devices: [{ ...IPHONE, label: '', platform: 'android' }],
        max_devices: 3,
      })
    )
    rerender(<AppLoginSection />)

    expect(await screen.findByText('Phone connected')).toBeInTheDocument()
  })

  it('an expired code offers a new one instead of the code', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    // The shortest lifetime the screen accepts; it runs out on the next tick.
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 1 })
    const user = userEvent.setup()
    render(<AppLoginSection />)
    await openEnableAndSubmit()

    expect(
      await screen.findByText('The code has expired', {}, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('app-login-pairing-code')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Get a new code' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('closing an expired code re-reads the status once', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 1 })
    const user = userEvent.setup()
    render(<AppLoginSection />)
    await openEnableAndSubmit()
    await screen.findByText('The code has expired', {}, { timeout: 4000 })
    expect(invalidateStatus).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('The code has expired')).not.toBeInTheDocument()
    expect(invalidateStatus).toHaveBeenCalledTimes(1)
  })

  it('closing the code before the phone enrolled re-reads the status once', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    render(<AppLoginSection />)
    const { user } = await openEnableAndSubmit()
    await screen.findByTestId('app-login-pairing-code')
    expect(invalidateStatus).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByTestId('app-login-pairing-code')).not.toBeInTheDocument()
    expect(invalidateStatus).toHaveBeenCalledTimes(1)
    expect(statusMock).toHaveBeenLastCalledWith({ pollMs: false })
  })

  it('switching the toggle off while only a code is up drops it and re-reads once', async () => {
    statusMock.mockReturnValue(loaded(OFF))
    enableMutate.mockResolvedValue({ pairing_code: 'ABCDEFGH', expires_in: 300 })
    render(<AppLoginSection />)
    const { user } = await openEnableAndSubmit()
    await screen.findByTestId('app-login-pairing-code')

    await user.click(screen.getByRole('switch'))

    expect(screen.queryByTestId('app-login-pairing-code')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(invalidateStatus).toHaveBeenCalledTimes(1)
  })

  describe('bound', () => {
    const BOUND: AppLoginStatus = {
      feature_available: true,
      enabled: true,
      devices: [IPHONE],
      max_devices: 3,
    }

    it('lists the phone with platform, bind date, last use and an unbind button', () => {
      statusMock.mockReturnValue(loaded(BOUND))
      render(<AppLoginSection />)

      const row = screen.getByTestId('app-login-device')
      expect(row).toHaveTextContent('iPhone 15')
      expect(row).toHaveTextContent('iOS')
      expect(row).toHaveTextContent(/bound 25\D09\D2026/)
      expect(row).toHaveTextContent(/last used 26\D09\D2026/)
      expect(within(row).getByRole('button', { name: 'Unbind' })).toBeInTheDocument()
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('button', { name: 'Bind another phone' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bind a phone' })).not.toBeInTheDocument()
    })

    it('unbind asks first, then revokes that device', async () => {
      statusMock.mockReturnValue(loaded(BOUND))
      revokeMutate.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<AppLoginSection />)

      const row = screen.getByTestId('app-login-device')
      await user.click(within(row).getByRole('button', { name: 'Unbind' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Unbind the phone?')).toBeInTheDocument()
      expect(revokeMutate).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Unbind' }))
      expect(revokeMutate).toHaveBeenCalledWith('dev-1')
      await vi.waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Phone "iPhone 15" unbound')
      )
    })

    it('a double click on the confirmation sends one DELETE', async () => {
      statusMock.mockReturnValue(loaded(BOUND))
      let finish: () => void = () => {}
      revokeMutate.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve
        })
      )
      const user = userEvent.setup()
      render(<AppLoginSection />)

      await user.click(
        within(screen.getByTestId('app-login-device')).getByRole('button', { name: 'Unbind' })
      )
      const dialog = await screen.findByRole('dialog')
      await user.dblClick(within(dialog).getByRole('button', { name: 'Unbind' }))

      expect(revokeMutate).toHaveBeenCalledTimes(1)
      await act(async () => finish())
    })

    it('a phone without a name is «Phone» in the list, the question and the toast', async () => {
      statusMock.mockReturnValue(
        loaded({ ...BOUND, devices: [{ ...IPHONE, label: '', platform: 'android' }] })
      )
      revokeMutate.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<AppLoginSection />)

      const row = screen.getByTestId('app-login-device')
      expect(row).toHaveTextContent('Phone · Android')

      await user.click(within(row).getByRole('button', { name: 'Unbind' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/Phone "Phone" will no longer be able/)).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Unbind' }))
      await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Phone "Phone" unbound'))
    })

    it('enabled=true but the last phone was unbound: reads as off, offers «Bind a phone»', () => {
      statusMock.mockReturnValue(loaded({ ...BOUND, devices: [] }))
      render(<AppLoginSection />)

      expect(screen.getByText('Disabled')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('button', { name: 'Bind a phone' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bind another phone' })).not.toBeInTheDocument()
    })

    it('at the device cap there is no «bind another», only the hint', () => {
      statusMock.mockReturnValue(
        loaded({
          ...BOUND,
          max_devices: 1,
        })
      )
      render(<AppLoginSection />)

      expect(screen.queryByRole('button', { name: 'Bind another phone' })).not.toBeInTheDocument()
      expect(screen.getByText(/maximum number of phones is bound \(1\)/)).toBeInTheDocument()
    })

    it('switching the toggle off asks for the password (all phones get unbound)', async () => {
      statusMock.mockReturnValue(loaded(BOUND))
      const user = userEvent.setup()
      render(<AppLoginSection />)

      await user.click(screen.getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Turn off sign-in through the app?')).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Password')).toBeInTheDocument()
    })

    it('confirming the switch-off with the password disables and closes the modal', async () => {
      statusMock.mockReturnValue(loaded(BOUND))
      disableMutate.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<AppLoginSection />)

      await user.click(screen.getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Password'), 'secret')
      await user.click(within(dialog).getByRole('button', { name: 'Turn off' }))

      expect(disableMutate).toHaveBeenCalledWith({ password: 'secret' })
      await vi.waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Sign-in through the app is off, phones unbound')
      )
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })
})
