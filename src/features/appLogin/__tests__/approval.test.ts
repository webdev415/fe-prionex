import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_REQUEST_TTL_S,
  MAX_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  approvalRefusalOf,
  hasAppSecondFactor,
  isLoginRefusal,
  isModeUnavailable,
  isTransientRefusal,
  minutesToWait,
  pollIntervalMs,
  requestTtlSeconds,
} from '../lib/approval'

function http(status: number, data: unknown, headers: Record<string, string> = {}): AxiosError {
  const requestHeaders = new AxiosHeaders()
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers: requestHeaders }, null, {
    status,
    statusText: '',
    headers,
    config: { headers: requestHeaders },
    data,
  })
}

describe('approval helpers', () => {
  it('keeps the poll interval within what the server accepts', () => {
    expect(pollIntervalMs(2000)).toBe(2000)
    expect(pollIntervalMs(200)).toBe(MIN_POLL_INTERVAL_MS)
    expect(pollIntervalMs(60_000)).toBe(MAX_POLL_INTERVAL_MS)
    expect(pollIntervalMs(undefined)).toBe(DEFAULT_POLL_INTERVAL_MS)
    expect(pollIntervalMs(Number.NaN)).toBe(DEFAULT_POLL_INTERVAL_MS)
    expect(pollIntervalMs(0)).toBe(DEFAULT_POLL_INTERVAL_MS)
  })

  it('falls back to the design TTL for an unusable expires_in', () => {
    expect(requestTtlSeconds(90)).toBe(90)
    expect(requestTtlSeconds(0)).toBe(DEFAULT_REQUEST_TTL_S)
    expect(requestTtlSeconds('120')).toBe(DEFAULT_REQUEST_TTL_S)
    expect(requestTtlSeconds(null)).toBe(DEFAULT_REQUEST_TTL_S)
  })

  it("offers the phone in the 2FA step only when /login lists 'app'", () => {
    expect(hasAppSecondFactor(['app', 'totp'])).toBe(true)
    expect(hasAppSecondFactor(['totp'])).toBe(false)
    expect(hasAppSecondFactor(null)).toBe(false)
    expect(hasAppSecondFactor(undefined)).toBe(false)
  })

  it('rounds the wait up to whole minutes, never below one', () => {
    expect(minutesToWait(300)).toBe(5)
    expect(minutesToWait(301)).toBe(6)
    expect(minutesToWait(5)).toBe(1)
    expect(minutesToWait(null)).toBe(1)
  })

  it('reads code, message, retry_after and lockout_minutes from a coded detail', () => {
    const refusal = approvalRefusalOf(
      http(429, {
        detail: { code: 'APP_LOGIN_RATE_LIMITED', message: 'Slow down', retry_after: 240 },
      })
    )
    expect(refusal).toMatchObject({
      status: 429,
      code: 'APP_LOGIN_RATE_LIMITED',
      message: 'Slow down',
      retryAfterSeconds: 240,
      network: false,
    })
    expect(
      approvalRefusalOf(
        http(403, { detail: { code: 'ACCOUNT_LOCKED', message: 'Locked', lockout_minutes: 12 } })
      ).lockoutMinutes
    ).toBe(12)
  })

  it('takes retry_after from the Retry-After header when the body has none', () => {
    const refusal = approvalRefusalOf(
      http(429, { detail: { code: 'APP_LOGIN_POLL_TOO_FAST' } }, { 'retry-after': '3' })
    )
    expect(refusal.retryAfterSeconds).toBe(3)
  })

  it('treats a string detail as the message and a missing response as a network failure', () => {
    expect(approvalRefusalOf(http(404, { detail: 'Not Found' }))).toMatchObject({
      status: 404,
      code: null,
      message: 'Not Found',
    })
    const network = approvalRefusalOf(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(network).toMatchObject({ status: null, network: true })
    expect(isTransientRefusal(network)).toBe(true)
    expect(approvalRefusalOf(new Error('boom'))).toMatchObject({ status: null, network: false })
  })

  it('classifies the /login refusals, the transient failures and an unavailable phone', () => {
    const coded = (status: number, code: string | null) =>
      approvalRefusalOf(http(status, { detail: code ? { code, message: 'x' } : 'Not Found' }))

    expect(isLoginRefusal(coded(403, 'IP_NOT_ALLOWED'))).toBe(true)
    expect(isLoginRefusal(coded(403, 'ACCOUNT_LOCKED'))).toBe(true)
    expect(isLoginRefusal(coded(401, 'TWO_FACTOR_CHALLENGE_EXPIRED'))).toBe(true)
    expect(isLoginRefusal(coded(404, 'APP_LOGIN_REQUEST_NOT_FOUND'))).toBe(false)
    expect(isLoginRefusal(coded(403, 'SOMETHING_ELSE'))).toBe(false)

    expect(isTransientRefusal(coded(503, 'APP_LOGIN_UNAVAILABLE'))).toBe(true)
    expect(isTransientRefusal(coded(500, null))).toBe(false)

    expect(isModeUnavailable(coded(404, 'APP_LOGIN_MODE_DISABLED'))).toBe(true)
    expect(isModeUnavailable(coded(404, null))).toBe(true)
    expect(isModeUnavailable(coded(409, 'APP_LOGIN_NOT_ENABLED'))).toBe(true)
    expect(isModeUnavailable(coded(404, 'APP_LOGIN_REQUEST_NOT_FOUND'))).toBe(false)
  })
})
