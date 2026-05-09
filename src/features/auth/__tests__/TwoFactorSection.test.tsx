import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const useTwoFactorStatusMock = vi.fn()

// mutateAsync must return a Promise — TwoFactorSetupModal chains `.then` on
// the result the moment the modal opens.
const pending = () => new Promise<never>(() => {})
vi.mock('../hooks', () => ({
  useTwoFactorStatus: (...args: unknown[]) => useTwoFactorStatusMock(...args),
  useTwoFactorSetup: () => ({ mutateAsync: vi.fn(pending), isPending: false }),
  useTwoFactorEnable: () => ({ mutateAsync: vi.fn(pending), isPending: false }),
  useTwoFactorDisable: () => ({ mutateAsync: vi.fn(pending), isPending: false }),
  useTwoFactorRegenerateBackupCodes: () => ({
    mutateAsync: vi.fn(pending),
    isPending: false,
  }),
}))

import { TwoFactorSection } from '../components/TwoFactorSection'

describe('TwoFactorSection', () => {
  beforeEach(() => {
    useTwoFactorStatusMock.mockReset()
  })

  it('shows the loading hint while the status query is in flight', () => {
    useTwoFactorStatusMock.mockReturnValue({ data: undefined, isLoading: true })

    render(<TwoFactorSection />)

    expect(screen.getByText(/loading status/i)).toBeInTheDocument()
  })

  it('renders the Enable CTA when 2FA is disabled', () => {
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: false, backup_codes_remaining: 0 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    expect(screen.getByText(/disabled/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable google authenticator/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^disable$/i })).not.toBeInTheDocument()
  })

  it('renders the Disable + Regenerate CTAs when 2FA is enabled', () => {
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: true, backup_codes_remaining: 7 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    expect(screen.getByText(/^enabled$/i)).toBeInTheDocument()
    expect(screen.getByText(/7 backup codes remaining/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^disable$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new backup codes/i })).toBeInTheDocument()
  })

  it('flags low backup-code count with the regenerate warning', () => {
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: true, backup_codes_remaining: 1 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    expect(screen.getByText(/consider regenerating/i)).toBeInTheDocument()
  })

  it('opens the setup modal when the Enable button is clicked', async () => {
    const user = userEvent.setup()
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: false, backup_codes_remaining: 0 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    await user.click(screen.getByRole('button', { name: /enable google authenticator/i }))

    // Setup modal title is rendered as a <span>, not a heading.
    expect(screen.getByText(/^enable two-factor authentication$/i)).toBeInTheDocument()
  })

  it('opens the disable confirmation modal when Disable is clicked', async () => {
    const user = userEvent.setup()
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: true, backup_codes_remaining: 5 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    await user.click(screen.getByRole('button', { name: /^disable$/i }))

    expect(screen.getByText(/^disable two-factor authentication$/i)).toBeInTheDocument()
  })

  it('opens the regenerate modal when Regenerate is clicked', async () => {
    const user = userEvent.setup()
    useTwoFactorStatusMock.mockReturnValue({
      data: { enabled: true, backup_codes_remaining: 5 },
      isLoading: false,
    })

    render(<TwoFactorSection />)

    await user.click(screen.getByRole('button', { name: /new backup codes/i }))

    expect(screen.getByText(/^Regenerate backup codes$/i)).toBeInTheDocument()
  })

  it('treats undefined status as disabled and still offers the Enable CTA', () => {
    useTwoFactorStatusMock.mockReturnValue({ data: undefined, isLoading: false })

    render(<TwoFactorSection />)

    expect(screen.getByRole('button', { name: /enable google authenticator/i })).toBeInTheDocument()
  })
})
