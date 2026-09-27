import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { LoginApprovalPhase } from '../lib/approvalSession'

vi.mock('react-i18next', async () => (await import('./appLoginI18nMock')).appLoginI18nMock())

const { AppApprovalCard } = await import('../components/AppApprovalCard')
const { AppApprovalEntry } = await import('../components/AppApprovalEntry')
const { AppApprovalRequestCard } = await import('../components/AppApprovalRequestCard')

const T0 = new Date('2026-09-26T10:00:00Z').getTime()

function waiting(overrides: Partial<Extract<LoginApprovalPhase, { kind: 'waiting' }>> = {}) {
  return {
    kind: 'waiting' as const,
    number: 47,
    startedAt: T0,
    expiresAt: T0 + 120_000,
    ...overrides,
  }
}

function renderCard(
  phase: LoginApprovalPhase,
  mode: 'passwordless' | 'second_factor' = 'passwordless'
) {
  const handlers = { onCancel: vi.fn(), onResend: vi.fn(), onFallback: vi.fn() }
  const view = render(<AppApprovalCard phase={phase} mode={mode} username="olena" {...handlers} />)
  return { ...view, ...handlers }
}

describe('AppApprovalCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the number big and counts the request down every second', () => {
    renderCard(waiting())

    expect(screen.getByRole('heading')).toHaveTextContent('Confirm the sign-in on your phone')
    expect(screen.getByTestId('app-approval-number')).toHaveTextContent('47')
    expect(screen.getByText('Open Prionex Hub and enter this number:')).toBeInTheDocument()
    expect(screen.getByText('The request is valid for another 2:00')).toBeInTheDocument()
    expect(
      screen.getByText('No notification? Open Prionex Hub — the request is already there.')
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.getByText('The request is valid for another 1:52')).toBeInTheDocument()
  })

  it('stops its countdown timer when it unmounts', () => {
    const { unmount } = renderCard(waiting())
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('passwordless: «Скасувати» and «Увійти з паролем», no resend while waiting', () => {
    const { onCancel, onFallback } = renderCard(waiting())

    expect(screen.queryByRole('button', { name: 'Send again' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with password' }))
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  it('2FA: names the person, offers the TOTP code, and resend only after 30 s', () => {
    const { onResend, onFallback } = renderCard(waiting(), 'second_factor')

    expect(screen.getByText('Signed in as olena')).toBeInTheDocument()
    const resend = screen.getByRole('button', { name: 'Send again' })
    expect(resend).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(resend).toBeEnabled()
    fireEvent.click(resend)
    expect(onResend).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Enter the Google Authenticator code' }))
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  it('shows a spinner line while starting and while signing in, without cancel at the end', () => {
    const { rerender } = renderCard({ kind: 'starting' })
    expect(screen.getByText('Sending the request to your phone…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    rerender(
      <AppApprovalCard
        phase={{ kind: 'completing' }}
        mode="passwordless"
        onCancel={vi.fn()}
        onResend={vi.fn()}
        onFallback={vi.fn()}
      />
    )
    expect(screen.getByText('Sign-in confirmed. Signing you in…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('expired: the design text and «Надіслати ще раз»', () => {
    const { onResend, onFallback } = renderCard({ kind: 'expired' })

    expect(screen.getByRole('alert')).toHaveTextContent('The time to confirm has run out.')
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    expect(onResend).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with password' }))
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  it.each<[LoginApprovalPhase, 'passwordless' | 'second_factor', string, string]>([
    [
      { kind: 'denied' },
      'passwordless',
      'The sign-in was declined on the phone.',
      'Sign in with password',
    ],
    [
      { kind: 'failed' },
      'passwordless',
      'Could not confirm the sign-in. Sign in with your password.',
      'Sign in with password',
    ],
    [
      { kind: 'failed' },
      'second_factor',
      'Could not confirm the sign-in on the phone. Enter the Google Authenticator code.',
      'Enter the Google Authenticator code',
    ],
    [
      { kind: 'rateLimited', minutes: 4 },
      'passwordless',
      'Too many attempts. Try again in 4 min or sign in with your password.',
      'Sign in with password',
    ],
    [
      { kind: 'rateLimited', minutes: 2 },
      'second_factor',
      'Too many attempts. Try again in 2 min or enter the Google Authenticator code.',
      'Enter the Google Authenticator code',
    ],
    [
      { kind: 'blocked', minutes: 60 },
      'second_factor',
      'Sign-in with the app is blocked for now. Try again in 60 min or enter the Google Authenticator code.',
      'Enter the Google Authenticator code',
    ],
  ])('%o in %s mode: the outcome text and one way on', (phase, mode, text, fallback) => {
    const { onFallback } = renderCard(phase, mode)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.queryByRole('button', { name: 'Send again' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: fallback }))
    expect(onFallback).toHaveBeenCalledTimes(1)
  })
})

describe('AppApprovalEntry', () => {
  it('renders the divider, the secondary button and its hint', () => {
    const onClick = vi.fn()
    render(<AppApprovalEntry onClick={onClick} />)

    expect(screen.getByText('or')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Sign in with confirmation in Prionex/ })
    expect(button).toHaveAccessibleDescription(
      'Confirm the sign-in in the Prionex Hub app on your phone'
    )
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('AppApprovalRequestCard', () => {
  it('asks only for the login and trims it', () => {
    const onSubmit = vi.fn()
    render(<AppApprovalRequestCard onSubmit={onSubmit} onUsePassword={vi.fn()} />)

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: '  olena ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a request to my phone' }))
    expect(onSubmit).toHaveBeenCalledWith('olena')
  })

  it('refuses an empty login and keeps the previous one after a cancel', () => {
    const onSubmit = vi.fn()
    const { unmount } = render(
      <AppApprovalRequestCard onSubmit={onSubmit} onUsePassword={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send a request to my phone' }))
    expect(screen.getByText('Enter your username')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    unmount()

    render(
      <AppApprovalRequestCard initialUsername="olena" onSubmit={onSubmit} onUsePassword={vi.fn()} />
    )
    expect(screen.getByLabelText(/Username/)).toHaveValue('olena')
  })

  it('«Увійти з паролем» goes back to the password form', () => {
    const onUsePassword = vi.fn()
    render(<AppApprovalRequestCard onSubmit={vi.fn()} onUsePassword={onUsePassword} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with password' }))
    expect(onUsePassword).toHaveBeenCalledTimes(1)
  })
})
