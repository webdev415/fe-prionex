import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('react-i18next', async () => (await import('./appLoginI18nMock')).appLoginI18nMock())

const disableMutate = vi.fn()

vi.mock('../hooks/useAppLogin', () => ({
  useDisableAppLogin: () => ({ mutateAsync: disableMutate, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { toast } = await import('sonner')
const { AppLoginDisableModal } = await import('../components/AppLoginDisableModal')

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

function renderModal() {
  const onClose = vi.fn()
  const onDisabled = vi.fn()
  const user = userEvent.setup()
  render(<AppLoginDisableModal open onClose={onClose} onDisabled={onDisabled} />)
  return { onClose, onDisabled, user }
}

async function submit(user: ReturnType<typeof userEvent.setup>, password?: string) {
  if (password) await user.type(await screen.findByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Turn off' }))
}

describe('AppLoginDisableModal', () => {
  beforeEach(() => {
    disableMutate.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it('an empty password is refused before any request', async () => {
    const { user, onClose, onDisabled } = renderModal()

    await submit(user)

    expect(await screen.findByText('Enter your password')).toBeInTheDocument()
    expect(disableMutate).not.toHaveBeenCalled()
    expect(onDisabled).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('success: sends the password, toasts, reports the switch-off, then closes', async () => {
    disableMutate.mockResolvedValue(undefined)
    const { user, onClose, onDisabled } = renderModal()

    await submit(user, 'secret')

    expect(disableMutate).toHaveBeenCalledWith({ password: 'secret' })
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Sign-in through the app is off, phones unbound')
    expect(onDisabled).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // The parent drops its pairing state before the modal goes away.
    expect(onDisabled.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0])
  })

  it('401 with the server text: the refusal stays in the modal', async () => {
    disableMutate.mockRejectedValue(http(401, 'Invalid password'))
    const { user, onClose, onDisabled } = renderModal()

    await submit(user, 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password')
    expect(onDisabled).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('401 INVALID_CREDENTIALS is shown localized', async () => {
    disableMutate.mockRejectedValue(
      http(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid password' })
    )
    const { user } = renderModal()

    await submit(user, 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password')
  })

  it('429 says «too many attempts», not «wrong password»', async () => {
    disableMutate.mockRejectedValue(
      http(429, { code: 'INVALID_CREDENTIALS', message: 'Invalid password' })
    )
    const { user, onClose } = renderModal()

    await submit(user, 'secret')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in a minute.'
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('any other failure says the switch-off did not happen', async () => {
    disableMutate.mockRejectedValue(http(503, 'Service Unavailable'))
    const { user } = renderModal()

    await submit(user, 'secret')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not turn off sign-in through the app'
    )
  })

  it('a double click sends one request', async () => {
    let finish: () => void = () => {}
    disableMutate.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    const { user } = renderModal()
    await user.type(await screen.findByLabelText('Password'), 'secret')

    await user.dblClick(screen.getByRole('button', { name: 'Turn off' }))
    expect(disableMutate).toHaveBeenCalledTimes(1)

    await act(async () => finish())
  })
})
