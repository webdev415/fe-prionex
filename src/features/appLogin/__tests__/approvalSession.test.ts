import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import type { LoginResponse } from '@/types/api'
import type { AppApprovalPoll, AppApprovalQrStart, AppApprovalStart } from '../types'

const api = vi.hoisted(() => ({
  config: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  cancel: vi.fn(),
  startQr: vi.fn(),
  refreshQr: vi.fn(),
}))
vi.mock('../api/loginApprovalApi', () => ({ loginApprovalApi: api, default: api }))

const { runApprovalSession } = await import('../lib/approvalSession')
type Phase = Parameters<Parameters<typeof runApprovalSession>[1]['onPhase']>[0]

const STARTED: AppApprovalStart = {
  request_id: 'req-1',
  browser_secret: 'secret-abc',
  number: 47,
  expires_in: 120,
  poll_interval_ms: 2000,
}
const LOGIN: LoginResponse = {
  token: 'jwt-token',
  user: { id: 7, username: 'olena' } as unknown as LoginResponse['user'],
}

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

function pending(expiresIn = 100): AppApprovalPoll {
  return { status: 'pending', expires_in: expiresIn, login: null }
}

function run(body: Parameters<typeof runApprovalSession>[0] = { username: 'olena' }) {
  const phases: Phase[] = []
  const handlers = {
    client: 'crm_web' as const,
    onPhase: vi.fn((phase: Phase) => phases.push(phase)),
    onApproved: vi.fn(),
    onRefused: vi.fn(),
    onUnavailable: vi.fn(),
  }
  const session = runApprovalSession(body, handlers)
  return { session, handlers, phases, last: () => phases[phases.length - 1] }
}

/** Resolve the pending promises and advance the fake clock. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('runApprovalSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    api.start.mockReset().mockResolvedValue(STARTED)
    api.poll.mockReset().mockResolvedValue(pending())
    api.cancel.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with the client, shows the number and polls with the secret in the body', async () => {
    const { handlers, last } = run()
    expect(last()).toEqual({ kind: 'starting' })
    await advance(0)

    expect(api.start).toHaveBeenCalledWith({ username: 'olena', client: 'crm_web' })
    expect(last()).toMatchObject({ kind: 'waiting', number: 47 })
    expect(api.poll).not.toHaveBeenCalled()

    await advance(2000)
    expect(api.poll).toHaveBeenCalledTimes(1)
    expect(api.poll).toHaveBeenCalledWith({ request_id: 'req-1', browser_secret: 'secret-abc' })
    await advance(2000)
    expect(api.poll).toHaveBeenCalledTimes(2)
    expect(handlers.onApproved).not.toHaveBeenCalled()
  })

  it('hands the approved LoginResponse over and stops polling', async () => {
    api.poll.mockResolvedValueOnce(pending()).mockResolvedValueOnce({
      status: 'approved',
      login: LOGIN,
    })
    const { handlers, last } = run()
    await advance(0)
    await advance(4000)

    expect(handlers.onApproved).toHaveBeenCalledWith(LOGIN)
    expect(last()).toEqual({ kind: 'completing' })
    await advance(20_000)
    expect(api.poll).toHaveBeenCalledTimes(2)
    expect(api.cancel).not.toHaveBeenCalled()
  })

  it('shows failed when persisting the approved login throws', async () => {
    api.poll.mockResolvedValueOnce({ status: 'approved', login: LOGIN })
    const { handlers, last } = run()
    handlers.onApproved.mockRejectedValueOnce(new Error('me failed'))
    await advance(0)
    await advance(2000)
    expect(last()).toEqual({ kind: 'failed' })
  })

  it.each([
    ['denied', 'denied'],
    ['expired', 'expired'],
  ] as const)('ends on %s and polls no more', async (status, kind) => {
    api.poll.mockResolvedValueOnce({ status, login: null })
    const { last } = run()
    await advance(0)
    await advance(2000)
    expect(last()).toEqual({ kind })
    await advance(20_000)
    expect(api.poll).toHaveBeenCalledTimes(1)
  })

  it('waits the retry_after of APP_LOGIN_POLL_TOO_FAST before the next poll', async () => {
    api.poll.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_POLL_TOO_FAST', message: 'slow', retry_after: 5 })
    )
    run()
    await advance(0)
    await advance(2000)
    expect(api.poll).toHaveBeenCalledTimes(1)
    await advance(4999)
    expect(api.poll).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(api.poll).toHaveBeenCalledTimes(2)
  })

  it('keeps polling through a transient 503 or a network error', async () => {
    api.poll
      .mockRejectedValueOnce(http(503, { code: 'APP_LOGIN_UNAVAILABLE', message: 'x' }))
      .mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
    const { last } = run()
    await advance(0)
    await advance(6000)
    expect(api.poll).toHaveBeenCalledTimes(3)
    expect(last()).toMatchObject({ kind: 'waiting' })
  })

  it('hands a /login refusal of the collected approval to the login screen', async () => {
    const refusal = http(403, { code: 'IP_NOT_ALLOWED', message: 'IP not allowed' })
    api.poll.mockRejectedValueOnce(refusal)
    const { handlers } = run()
    await advance(0)
    await advance(2000)
    expect(handlers.onRefused).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, code: 'IP_NOT_ALLOWED' })
    )
    await advance(20_000)
    expect(api.poll).toHaveBeenCalledTimes(1)
  })

  it('shows failed for an unknown request (another address, wrong secret)', async () => {
    api.poll.mockRejectedValueOnce(
      http(404, { code: 'APP_LOGIN_REQUEST_NOT_FOUND', message: 'not found' })
    )
    const { last, handlers } = run()
    await advance(0)
    await advance(2000)
    expect(last()).toEqual({ kind: 'failed' })
    expect(handlers.onRefused).not.toHaveBeenCalled()
  })

  it('stops at the request lifetime even if the server keeps saying pending', async () => {
    api.start.mockResolvedValue({ ...STARTED, expires_in: 10 })
    // A server that never counts down must not keep the browser polling.
    api.poll.mockResolvedValue({ status: 'pending', expires_in: null, login: null })
    const { last } = run()
    await advance(0)
    await advance(12_000)
    expect(last()).toEqual({ kind: 'expired' })
    const polls = api.poll.mock.calls.length
    await advance(20_000)
    expect(api.poll).toHaveBeenCalledTimes(polls)
  })

  it('stop() while waiting cancels the request on the server and ends the timer', async () => {
    const { session, phases } = run()
    await advance(0)
    const before = phases.length
    session.stop()
    expect(api.cancel).toHaveBeenCalledWith({ request_id: 'req-1', browser_secret: 'secret-abc' })
    await advance(20_000)
    expect(api.poll).not.toHaveBeenCalled()
    expect(phases).toHaveLength(before)
  })

  it('stop() while the start is in flight cancels the request once it exists', async () => {
    let resolveStart: (value: AppApprovalStart) => void = () => {}
    api.start.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)))
    const { session, last } = run()
    session.stop()
    resolveStart(STARTED)
    await advance(0)
    expect(api.cancel).toHaveBeenCalledWith({ request_id: 'req-1', browser_secret: 'secret-abc' })
    expect(last()).toEqual({ kind: 'starting' })
    await advance(20_000)
    expect(api.poll).not.toHaveBeenCalled()
  })

  it('reads a start 429 as rate limited or, after «Це не я», blocked — in minutes', async () => {
    api.start.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_RATE_LIMITED', message: 'x', retry_after: 300 })
    )
    const limited = run()
    await advance(0)
    expect(limited.last()).toEqual({ kind: 'rateLimited', minutes: 5 })

    api.start.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_BLOCKED', message: 'x', retry_after: 3600 })
    )
    const blocked = run({ two_factor_token: 'challenge' })
    await advance(0)
    expect(blocked.last()).toEqual({ kind: 'blocked', minutes: 60 })
    expect(api.start).toHaveBeenLastCalledWith({ two_factor_token: 'challenge', client: 'crm_web' })
  })

  it('reports an unavailable phone (no switch, mode off) instead of a failure', async () => {
    api.start.mockRejectedValueOnce(
      http(409, { code: 'APP_LOGIN_NOT_ENABLED', message: 'no phone' })
    )
    const { handlers } = run({ two_factor_token: 'challenge' })
    await advance(0)
    expect(handlers.onUnavailable).toHaveBeenCalledTimes(1)
    expect(handlers.onRefused).not.toHaveBeenCalled()
  })

  it('hands a dead 2FA challenge at start to the login screen', async () => {
    api.start.mockRejectedValueOnce(
      http(401, { code: 'TWO_FACTOR_CHALLENGE_EXPIRED', message: 'expired' })
    )
    const { handlers } = run({ two_factor_token: 'challenge' })
    await advance(0)
    expect(handlers.onRefused).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TWO_FACTOR_CHALLENGE_EXPIRED' })
    )
  })

  it('shows failed when the start cannot reach the server', async () => {
    api.start.mockRejectedValueOnce(http(503, { code: 'APP_LOGIN_UNAVAILABLE', message: 'x' }))
    const { last } = run()
    await advance(0)
    expect(last()).toEqual({ kind: 'failed' })
  })
})

const QR_STARTED: AppApprovalQrStart = {
  request_id: 'req-q',
  browser_secret: 'secret-q',
  qr_payload: 'prionex-app-login-qr/v1|dev|first',
  qr_expires_in: 60,
  qr_refresh_in: 30,
  expires_in: 120,
  poll_interval_ms: 2000,
}
const QR_PAIR = { request_id: 'req-q', browser_secret: 'secret-q' }

function qrPayloadOf(phase: Phase | undefined): string | null {
  return phase?.kind === 'qr' ? phase.payload : null
}

describe('runApprovalSession — QR (story 19.17)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    api.start.mockReset()
    api.startQr.mockReset().mockResolvedValue(QR_STARTED)
    api.refreshQr.mockReset().mockImplementation(async () => ({
      qr_payload: `prionex-app-login-qr/v1|dev|n${api.refreshQr.mock.calls.length}`,
      qr_expires_in: 60,
      qr_refresh_in: 30,
    }))
    api.poll.mockReset().mockResolvedValue(pending())
    api.cancel.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens a QR request without a login and shows its payload as is', async () => {
    const { last } = run({ qr: true })
    await advance(0)

    expect(api.startQr).toHaveBeenCalledWith({ client: 'crm_web' })
    expect(api.start).not.toHaveBeenCalled()
    expect(last()).toMatchObject({ kind: 'qr', payload: 'prionex-app-login-qr/v1|dev|first' })
    const phase = last()
    expect(phase.kind === 'qr' && phase.expiresAt - phase.startedAt).toBe(120_000)

    await advance(2000)
    expect(api.poll).toHaveBeenCalledWith(QR_PAIR)
  })

  it('asks for the next QR every qr_refresh_in seconds while nobody scans it', async () => {
    const { phases, last } = run({ qr: true })
    await advance(0)

    await advance(29_999)
    expect(api.refreshQr).not.toHaveBeenCalled()
    await advance(1)
    expect(api.refreshQr).toHaveBeenCalledWith(QR_PAIR)
    expect(qrPayloadOf(last())).toBe('prionex-app-login-qr/v1|dev|n1')

    await advance(30_000)
    expect(api.refreshQr).toHaveBeenCalledTimes(2)
    expect(qrPayloadOf(last())).toBe('prionex-app-login-qr/v1|dev|n2')
    // The request keeps its own clock: a new code does not extend it.
    const shown = phases.filter((phase) => phase.kind === 'qr')
    expect(new Set(shown.map((phase) => phase.kind === 'qr' && phase.expiresAt)).size).toBe(1)
  })

  it('scanned: stops the QR refresh and restarts the window from the scan', async () => {
    api.poll.mockResolvedValueOnce(pending()).mockResolvedValue({
      status: 'scanned',
      expires_in: 120,
      login: null,
    })
    const { last } = run({ qr: true })
    await advance(0)
    await advance(4000)

    const phase = last()
    expect(phase.kind).toBe('scanned')
    expect(phase.kind === 'scanned' && phase.expiresAt - phase.startedAt).toBe(120_000)
    await advance(60_000)
    expect(api.refreshQr).not.toHaveBeenCalled()
    // Still polling past the first request's 120 s: the scan gave a new window.
    await advance(60_000)
    expect(last().kind).toBe('scanned')
    expect(api.poll.mock.calls.length).toBeGreaterThan(60)
  })

  it('approved after the scan: hands the LoginResponse over and ends every timer', async () => {
    api.poll
      .mockResolvedValueOnce({ status: 'scanned', expires_in: 110, login: null })
      .mockResolvedValueOnce({ status: 'approved', login: LOGIN })
    const { handlers, last } = run({ qr: true })
    await advance(0)
    await advance(4000)

    expect(handlers.onApproved).toHaveBeenCalledWith(LOGIN)
    expect(last()).toEqual({ kind: 'completing' })
    await advance(120_000)
    expect(api.poll).toHaveBeenCalledTimes(2)
    expect(api.refreshQr).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a refresh that lands after the scan does not bring the QR back', async () => {
    let resolveRefresh: (value: unknown) => void = () => {}
    api.refreshQr.mockReturnValueOnce(new Promise((resolve) => (resolveRefresh = resolve)))
    api.poll.mockImplementation(async () =>
      Date.now() >= 31_000
        ? { status: 'scanned', expires_in: 120, login: null }
        : { status: 'pending', expires_in: 100, login: null }
    )
    vi.setSystemTime(0)
    const { last } = run({ qr: true })
    await advance(0)
    await advance(30_000) // the refresh is in flight
    await advance(2000) // the poll says scanned
    expect(last().kind).toBe('scanned')
    resolveRefresh({ qr_payload: 'late', qr_expires_in: 60, qr_refresh_in: 30 })
    await advance(0)
    expect(last().kind).toBe('scanned')
  })

  it('retries a failed refresh no sooner than 10 s, and leaves 409/410 to the poll', async () => {
    api.refreshQr
      .mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
      .mockRejectedValueOnce(http(503, { code: 'APP_LOGIN_UNAVAILABLE', message: 'x' }))
      .mockRejectedValueOnce(
        http(409, { code: 'APP_LOGIN_REQUEST_ALREADY_DECIDED', message: 'decided' })
      )
    const { last } = run({ qr: true })
    await advance(0)
    await advance(30_000)
    expect(api.refreshQr).toHaveBeenCalledTimes(1)
    await advance(9_999)
    expect(api.refreshQr).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(api.refreshQr).toHaveBeenCalledTimes(2)
    await advance(10_000)
    expect(api.refreshQr).toHaveBeenCalledTimes(3)
    // 409: no more refreshes; the code on screen and the poll carry on.
    await advance(40_000)
    expect(api.refreshQr).toHaveBeenCalledTimes(3)
    expect(qrPayloadOf(last())).toBe('prionex-app-login-qr/v1|dev|first')
  })

  it('ends expired at the request lifetime when nobody scans', async () => {
    api.poll.mockResolvedValue({ status: 'pending', expires_in: null, login: null })
    const { last } = run({ qr: true })
    await advance(0)
    await advance(123_000)
    expect(last()).toEqual({ kind: 'expired' })
    const refreshes = api.refreshQr.mock.calls.length
    await advance(60_000)
    expect(api.refreshQr).toHaveBeenCalledTimes(refreshes)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ['denied', 'denied'],
    ['expired', 'expired'],
  ] as const)('ends on %s and stops refreshing', async (status, kind) => {
    api.poll.mockResolvedValueOnce({ status, login: null })
    const { last } = run({ qr: true })
    await advance(0)
    await advance(2000)
    expect(last()).toEqual({ kind })
    await advance(60_000)
    expect(api.refreshQr).not.toHaveBeenCalled()
  })

  it('a 404 on /qr (mode off) reports unavailable; a 429 reads as rate limited', async () => {
    api.startQr.mockRejectedValueOnce(http(404, 'Not Found'))
    const off = run({ qr: true })
    await advance(0)
    expect(off.handlers.onUnavailable).toHaveBeenCalledTimes(1)

    api.startQr.mockRejectedValueOnce(
      http(429, { code: 'APP_LOGIN_RATE_LIMITED', message: 'x', retry_after: 240 })
    )
    const limited = run({ qr: true })
    await advance(0)
    expect(limited.last()).toEqual({ kind: 'rateLimited', minutes: 4 })
  })

  it('a network error or 5xx at the start shows failed — no retry loop', async () => {
    api.startQr.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
    const { last } = run({ qr: true })
    await advance(0)
    expect(last()).toEqual({ kind: 'failed' })
    await advance(60_000)
    expect(api.startQr).toHaveBeenCalledTimes(1)
    expect(api.poll).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop() cancels the QR request and ends both timers', async () => {
    const { session } = run({ qr: true })
    await advance(0)
    session.stop()
    expect(api.cancel).toHaveBeenCalledWith(QR_PAIR)
    expect(vi.getTimerCount()).toBe(0)
    await advance(60_000)
    expect(api.poll).not.toHaveBeenCalled()
    expect(api.refreshQr).not.toHaveBeenCalled()
  })
})
