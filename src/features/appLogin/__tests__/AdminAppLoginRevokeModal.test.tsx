import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AppLoginStatus } from '../types'

vi.mock('react-i18next', async () => (await import('./appLoginI18nMock')).appLoginI18nMock())

const statusMock = vi.fn()
const revokeAll = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
}

vi.mock('../hooks/useAppLogin', () => ({
  useAdminAppLoginStatus: (...args: unknown[]) => statusMock(...args),
  useAdminRevokeAllAppLogin: () => revokeAll,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { AdminAppLoginRevokeModal } = await import('../components/AdminAppLoginRevokeModal')

const USER = { id: 42, username: 'okovalchuk', email: 'olena@test.com' }

function loaded(data: AppLoginStatus) {
  return { data, isLoading: false, isError: false, error: null }
}

function http404(): AxiosError {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
    status: 404,
    statusText: '',
    headers: {},
    config: { headers },
    data: { detail: 'Not Found' },
  })
}

describe('AdminAppLoginRevokeModal', () => {
  beforeEach(() => {
    statusMock.mockReset()
    revokeAll.mutate.mockReset()
    revokeAll.isError = false
    revokeAll.error = null
  })

  it('reads the status of the chosen user only while open', () => {
    statusMock.mockReturnValue(loaded({ feature_available: true, devices: [] }))
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)
    expect(statusMock).toHaveBeenCalledWith(42, true)
  })

  it('lists the user’s phones and unbinds them all on confirm', async () => {
    statusMock.mockReturnValue(
      loaded({
        feature_available: true,
        enabled: true,
        devices: [
          { id: 'd1', label: 'iPhone 15', platform: 'ios', created_at: '2026-09-25T10:00:00Z' },
          { id: 'd2', label: 'Pixel 8', platform: 'android', created_at: '2026-09-24T10:00:00Z' },
        ],
      })
    )
    const user = userEvent.setup()
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('okovalchuk')).toBeInTheDocument()
    expect(within(dialog).getAllByTestId('app-login-device')).toHaveLength(2)
    // Read-only list: the admin unbinds all at once, not one by one.
    expect(within(dialog).queryByRole('button', { name: 'Unbind' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Unbind all phones' }))
    expect(revokeAll.mutate).toHaveBeenCalledWith(42, expect.any(Object))
  })

  it('nothing to unbind: the confirm button is disabled', async () => {
    statusMock.mockReturnValue(loaded({ feature_available: true, enabled: false, devices: [] }))
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('No phones yet')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Unbind all phones' })).toBeDisabled()
  })

  it('feature off on the server (404): says so and offers no action', async () => {
    statusMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: http404(),
    })
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Sign-in through the mobile app is turned off on this server.')
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Unbind all phones' })).toBeDisabled()
  })

  it('feature off as the API answers the admin GET (200, feature_available=false)', async () => {
    statusMock.mockReturnValue(loaded({ feature_available: false, max_devices: 3 }))
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Sign-in through the mobile app is turned off on this server.')
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Unbind all phones' })).toBeDisabled()
  })

  it('a refused revoke-all shows the API message from {detail: {code, message}}', async () => {
    statusMock.mockReturnValue(
      loaded({
        feature_available: true,
        devices: [{ id: 'd1', label: 'iPhone', platform: 'ios', created_at: null }],
      })
    )
    const headers = new AxiosHeaders()
    revokeAll.isError = true
    revokeAll.error = new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
      status: 404,
      statusText: '',
      headers: {},
      config: { headers },
      data: { detail: { code: 'USER_NOT_FOUND', message: 'User not found' } },
    })
    render(<AdminAppLoginRevokeModal open user={USER} onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('User not found')).toBeInTheDocument()
  })
})
