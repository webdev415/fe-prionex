/**
 * The browser side of the phone-confirmed sign-in: the four public routes, and
 * `browser_secret` only ever in a request body — never in a URL.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const client = { get, post }
  return { ...actual, default: client, api: client }
})

const { loginApprovalApi } = await import('../api/loginApprovalApi')

const CONFIG = { passwordless: true, second_factor: true, request_ttl: 120, poll_interval_ms: 2000 }
const STARTED = {
  request_id: 'req-1',
  browser_secret: 'secret-abc',
  number: 47,
  expires_in: 120,
  poll_interval_ms: 2000,
}
const PAIR = { request_id: 'req-1', browser_secret: 'secret-abc' }

describe('loginApprovalApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: CONFIG })
    post.mockResolvedValue({ data: STARTED })
  })

  it('reads the config from the public route', async () => {
    await expect(loginApprovalApi.config()).resolves.toEqual(CONFIG)
    expect(get).toHaveBeenCalledWith('/api/v1/auth/app-login/config')
  })

  it('starts with the body as given (passwordless and 2FA)', async () => {
    await expect(loginApprovalApi.start({ username: 'olena', client: 'crm_web' })).resolves.toEqual(
      STARTED
    )
    expect(post).toHaveBeenLastCalledWith('/api/v1/auth/app-login/start', {
      username: 'olena',
      client: 'crm_web',
    })

    await loginApprovalApi.start({ two_factor_token: 'challenge', client: 'crm_web' })
    expect(post).toHaveBeenLastCalledWith('/api/v1/auth/app-login/start', {
      two_factor_token: 'challenge',
      client: 'crm_web',
    })
  })

  it('polls and cancels with the secret in the body only', async () => {
    post.mockResolvedValueOnce({ data: { status: 'pending', expires_in: 90, login: null } })
    await expect(loginApprovalApi.poll(PAIR)).resolves.toEqual({
      status: 'pending',
      expires_in: 90,
      login: null,
    })
    await expect(loginApprovalApi.cancel(PAIR)).resolves.toBeUndefined()

    expect(post).toHaveBeenCalledWith('/api/v1/auth/app-login/poll', PAIR)
    expect(post).toHaveBeenCalledWith('/api/v1/auth/app-login/cancel', PAIR)
    for (const [url] of [...post.mock.calls, ...get.mock.calls]) {
      expect(String(url)).not.toContain('secret-abc')
    }
  })

  it('opens a QR request and refreshes its QR with the secret in the body only', async () => {
    const qr = {
      request_id: 'req-q',
      browser_secret: 'secret-q',
      qr_payload: 'prionex-app-login-qr/v1|dev|r|s',
      qr_expires_in: 60,
      qr_refresh_in: 30,
      expires_in: 120,
      poll_interval_ms: 2000,
    }
    post.mockResolvedValueOnce({ data: qr })
    await expect(loginApprovalApi.startQr({ client: 'crm_web' })).resolves.toEqual(qr)
    expect(post).toHaveBeenLastCalledWith('/api/v1/auth/app-login/qr', { client: 'crm_web' })

    const next = {
      qr_payload: 'prionex-app-login-qr/v1|dev|r|t',
      qr_expires_in: 60,
      qr_refresh_in: 30,
    }
    post.mockResolvedValueOnce({ data: next })
    const pair = { request_id: 'req-q', browser_secret: 'secret-q' }
    await expect(loginApprovalApi.refreshQr(pair)).resolves.toEqual(next)
    expect(post).toHaveBeenLastCalledWith('/api/v1/auth/app-login/qr/refresh', pair)
    for (const [url] of post.mock.calls) {
      expect(String(url)).not.toContain('secret-q')
      expect(String(url)).not.toContain('prionex-app-login-qr')
    }
  })
})
