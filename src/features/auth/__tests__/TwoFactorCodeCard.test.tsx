import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwoFactorCodeCard } from '../components/TwoFactorCodeCard'

describe('TwoFactorCodeCard', () => {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    onSubmit.mockReset()
    onCancel.mockReset()
  })

  it('renders the TOTP prompt with the signed-in username', () => {
    render(<TwoFactorCodeCard username="alice" onSubmit={onSubmit} onCancel={onCancel} />)

    expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument()
    expect(screen.getByText(/signed in as alice/i)).toBeInTheDocument()
  })

  it('rejects a TOTP that is not exactly six digits', async () => {
    const user = userEvent.setup()
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.type(screen.getByLabelText(/authentication code/i), '12345')
    await user.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => {
      // Subtitle and validation error happen to share the same copy, so two
      // matches is the success signal (subtitle + inline error banner).
      expect(
        screen.getAllByText(/enter the 6-digit code from your authenticator app/i)
      ).toHaveLength(2)
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('passes the trimmed 6-digit code to onSubmit', async () => {
    const user = userEvent.setup()
    onSubmit.mockResolvedValue(undefined)
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.type(screen.getByLabelText(/authentication code/i), '123456')
    await user.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('123456')
    })
  })

  it('strips non-digits from the TOTP input', async () => {
    const user = userEvent.setup()
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    const input = screen.getByLabelText(/authentication code/i) as HTMLInputElement
    await user.type(input, '12a3b4c5d6')

    expect(input.value).toBe('123456')
  })

  it('toggles between authenticator and backup-code modes', async () => {
    const user = userEvent.setup()
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /use a backup code instead/i }))
    expect(screen.getByLabelText(/backup code/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /use authenticator code instead/i }))
    expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument()
  })

  it('rejects backup codes shorter than 8 characters', async () => {
    const user = userEvent.setup()
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /use a backup code instead/i }))
    await user.type(screen.getByLabelText(/backup code/i), 'short')
    await user.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => {
      expect(screen.getByText(/backup code looks too short/i)).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('forwards a long backup code unchanged', async () => {
    const user = userEvent.setup()
    onSubmit.mockResolvedValue(undefined)
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /use a backup code instead/i }))
    await user.type(screen.getByLabelText(/backup code/i), 'abcd1234-efgh5678')
    await user.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('abcd1234-efgh5678')
    })
  })

  it('renders the server-provided error verbatim', () => {
    render(
      <TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} error="Invalid or expired code" />
    )
    expect(screen.getByText(/invalid or expired code/i)).toBeInTheDocument()
  })

  it('disables the input and submit button while loading', () => {
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} isLoading />)

    expect(screen.getByLabelText(/authentication code/i)).toBeDisabled()
    // While loading the submit button label changes to "Loading..." (Button
    // component spinner state).
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
  })

  it('calls onCancel when the back-to-login link is clicked', async () => {
    const user = userEvent.setup()
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancel and back to login/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('submit button is disabled when the code field is empty', () => {
    render(<TwoFactorCodeCard onSubmit={onSubmit} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: /^verify$/i })).toBeDisabled()
  })
})
