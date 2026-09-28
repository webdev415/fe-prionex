import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { LoginApprovalPhase } from '../lib/approvalSession'

vi.mock('react-i18next', async () => (await import('./appLoginI18nMock')).appLoginI18nMock())

const { AppQrLoginCard } = await import('../components/AppQrLoginCard')
const { encodeQr } = await import('../lib/qrCode')

const T0 = new Date('2026-09-28T20:00:00Z').getTime()
const PAYLOAD =
  'prionex-app-login-qr/v1|dev|AbCdEfGhIjKlMnOpQrStUv|0123456789abcdefghijklmnopqrstuvwxyzABCDEFG'

function qr(payload = PAYLOAD): LoginApprovalPhase {
  return { kind: 'qr', payload, startedAt: T0, expiresAt: T0 + 120_000 }
}

function renderCard(phase: LoginApprovalPhase) {
  const onRestart = vi.fn()
  const view = render(<AppQrLoginCard phase={phase} onRestart={onRestart} />)
  return { ...view, onRestart }
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('AppQrLoginCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('draws the QR, the hint and the time the request has left', () => {
    renderCard(qr())

    expect(screen.getByRole('heading')).toHaveTextContent('Sign in with a QR code')
    expect(screen.getByText('Scan the code in the HUB app → Security')).toBeInTheDocument()
    const image = screen.getByRole('img', { name: 'QR code for signing in to CRM' })
    expect(image.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/)
    expect(screen.getByText('The code is valid for another 2:00')).toBeInTheDocument()

    tick(15_000)
    expect(screen.getByText('The code is valid for another 1:45')).toBeInTheDocument()
  })

  it('never puts the payload in text or an attribute, and hides the code from session replay', () => {
    const { container } = renderCard(qr())

    expect(container.textContent).not.toContain('prionex-app-login-qr')
    const attributes = [...container.querySelectorAll('*')].flatMap((node) =>
      node.getAttributeNames().map((name) => node.getAttribute(name) ?? '')
    )
    expect(attributes.some((value) => value.includes('AbCdEfGh'))).toBe(false)
    expect(screen.getByRole('img').closest('[data-openreplay-hidden]')).not.toBeNull()
  })

  it('the drawing is exactly the encoded matrix, inside a 4-module quiet zone', () => {
    renderCard(qr())
    const svg = screen.getByRole('img')
    const matrix = encodeQr(PAYLOAD)
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${matrix.length + 8} ${matrix.length + 8}`)

    const drawn = matrix.map((row) => row.map(() => false))
    const d = svg.querySelector('path')?.getAttribute('d') ?? ''
    expect(d.replace(/M(\d+) (\d+)h(\d+)v1h-\3z/g, '')).toBe('')
    for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      for (let i = 0; i < Number(run); i++) drawn[Number(y) - 4][Number(x) - 4 + i] = true
    }
    expect(drawn).toEqual(matrix)
  })

  it('redraws when the payload rotates', () => {
    const { rerender } = renderCard(qr())
    const before = screen.getByRole('img').querySelector('path')?.getAttribute('d')
    rerender(<AppQrLoginCard phase={qr(`${PAYLOAD.slice(0, -1)}H`)} onRestart={vi.fn()} />)
    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(before)
  })

  it('scanned: asks to confirm on the phone, with the new window', () => {
    renderCard({ kind: 'scanned', startedAt: T0, expiresAt: T0 + 90_000 })

    expect(screen.getByRole('heading')).toHaveTextContent('Confirm the sign-in on your phone')
    expect(
      screen.getByText('The code has been scanned. Confirm the sign-in in Prionex Hub.')
    ).toBeInTheDocument()
    expect(screen.getByText('The request is valid for another 1:30')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    [{ kind: 'starting' } as const, 'Preparing the QR code…'],
    [{ kind: 'completing' } as const, 'Sign-in confirmed. Signing you in…'],
  ])('%o shows a spinner line', (phase, text) => {
    renderCard(phase)
    expect(screen.getByRole('status')).toHaveTextContent(text)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    [{ kind: 'denied' } as const, 'The sign-in was declined on the phone.', 'New code'],
    [{ kind: 'expired' } as const, 'The QR code has expired.', 'New code'],
    [
      { kind: 'rateLimited', minutes: 4 } as const,
      'Too many QR codes from this network. Try again in 4 min or sign in with your password.',
      'New code',
    ],
    [
      { kind: 'failed' } as const,
      'Could not get a QR code. Check the connection and try again.',
      'Try again',
    ],
  ])('%o: a clear text and one button', (phase, text, button) => {
    renderCard(phase)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('button', { name: button })).toBeInTheDocument()
  })

  it('opens a new code at most once per 5 seconds', () => {
    const { onRestart } = renderCard({ kind: 'failed' })
    const button = () => screen.getByRole('button', { name: 'Try again' })

    // The tab opened a request as the card mounted: the first 5 s are cooling down.
    expect(button()).toBeDisabled()
    fireEvent.click(button())
    expect(onRestart).not.toHaveBeenCalled()

    tick(5000)
    expect(button()).toBeEnabled()
    fireEvent.click(button())
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(button()).toBeDisabled()
    fireEvent.click(button())
    expect(onRestart).toHaveBeenCalledTimes(1)

    tick(4000)
    expect(button()).toBeDisabled()
    tick(1000)
    fireEvent.click(button())
    expect(onRestart).toHaveBeenCalledTimes(2)
  })

  it('stops its timer when it unmounts', () => {
    const { unmount } = renderCard(qr())
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
