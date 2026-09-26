/**
 * The request flags are the point of these calls, not a detail:
 * - the password checks (enable/disable) carry `_skipAuthRedirect`, so a wrong
 *   password answered with 401 stays a refusal in the modal instead of the
 *   global interceptor signing the person out mid-form;
 * - the status reads carry `_noTransientRetry`, so an unreachable auth-service
 *   does not hold the profile up with the client's own retries — and they do
 *   NOT skip the auth redirect: an expired session must still end there.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const del = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const client = { get, post, delete: del }
  return { ...actual, default: client, api: client }
})

const { appLoginApi } = await import('../api/appLoginApi')

const STATUS = { feature_available: true, enabled: false, devices: [] }
const PAIRING = { pairing_code: 'ABCDEFGH', expires_in: 300 }

describe('appLoginApi request config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: STATUS })
    post.mockResolvedValue({ data: {} })
    del.mockResolvedValue({ data: {} })
  })

  it('own status: an optional read without transient retries, auth redirect kept', async () => {
    await expect(appLoginApi.myStatus()).resolves.toEqual(STATUS)

    expect(get).toHaveBeenCalledWith(
      '/api/v1/users/me/app-login',
      expect.objectContaining({ _noTransientRetry: true })
    )
    expect(get.mock.calls[0][1]).not.toHaveProperty('_skipAuthRedirect')
  })

  it('enable: the password check skips the auth redirect', async () => {
    post.mockResolvedValue({ data: PAIRING })

    await expect(appLoginApi.enable({ password: 'secret', code: '123456' })).resolves.toEqual(
      PAIRING
    )

    expect(post).toHaveBeenCalledWith(
      '/api/v1/users/me/app-login/enable',
      { password: 'secret', code: '123456' },
      expect.objectContaining({ _skipAuthRedirect: true })
    )
  })

  it('disable: the password check skips the auth redirect', async () => {
    await expect(appLoginApi.disable({ password: 'secret' })).resolves.toBeUndefined()

    expect(post).toHaveBeenCalledWith(
      '/api/v1/users/me/app-login/disable',
      { password: 'secret' },
      expect.objectContaining({ _skipAuthRedirect: true })
    )
  })

  it('a refused password check reaches the caller as it came', async () => {
    const refusal = new Error('401')
    post.mockRejectedValue(refusal)

    await expect(appLoginApi.disable({ password: 'wrong' })).rejects.toBe(refusal)
    await expect(appLoginApi.enable({ password: 'wrong' })).rejects.toBe(refusal)
  })

  it('unbinding one phone escapes the device id and needs no special flags', async () => {
    await expect(appLoginApi.revokeMyDevice('a/b?c')).resolves.toBeUndefined()

    expect(del).toHaveBeenCalledWith('/api/v1/users/me/app-login/devices/a%2Fb%3Fc')
  })

  it('admin status: the same optional read, for the chosen user', async () => {
    await expect(appLoginApi.adminStatus(42)).resolves.toEqual(STATUS)

    expect(get).toHaveBeenCalledWith(
      '/api/v1/admin/users/42/app-login',
      expect.objectContaining({ _noTransientRetry: true })
    )
    expect(get.mock.calls[0][1]).not.toHaveProperty('_skipAuthRedirect')
  })

  it('admin revoke-all posts to the chosen user without special flags', async () => {
    await expect(appLoginApi.adminRevokeAll(42)).resolves.toBeUndefined()

    expect(post).toHaveBeenCalledWith('/api/v1/admin/users/42/app-login/revoke-all')
  })
})
