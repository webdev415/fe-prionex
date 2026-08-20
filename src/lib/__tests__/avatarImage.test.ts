/**
 * Photos are fetched through the API client, so they carry the token the
 * endpoint requires. The cache is what keeps a list of employees from asking
 * for the same face once per row.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get }, api: { get } }
})

const { avatarSource, clearAvatarCache, loadAvatarObjectUrl, needsAuthenticatedFetch } =
  await import('../avatarImage')

describe('loadAvatarObjectUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAvatarCache()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:one')
    get.mockResolvedValue({ data: new Blob(['bytes']) })
  })

  it('asks the API client, so the request carries the token', async () => {
    const own = 'https://api.dev.crm-prionex.online/api/v1/users/avatars/1.png'
    await loadAvatarObjectUrl(own)

    expect(get).toHaveBeenCalledWith(own, expect.objectContaining({ responseType: 'blob' }))
  })

  it('fetches one photo once however many times it is asked for', async () => {
    await Promise.all([
      loadAvatarObjectUrl('/a.png'),
      loadAvatarObjectUrl('/a.png'),
      loadAvatarObjectUrl('/a.png'),
    ])

    expect(get).toHaveBeenCalledTimes(1)
  })

  it('fetches each distinct photo', async () => {
    await loadAvatarObjectUrl('/a.png')
    await loadAvatarObjectUrl('/b.png')

    expect(get).toHaveBeenCalledTimes(2)
  })

  it('does not remember a failure', async () => {
    // An expired token fails the fetch. Remembering that would leave the avatar
    // broken for the rest of the session even after signing back in.
    get.mockRejectedValueOnce(new Error('401'))
    await expect(loadAvatarObjectUrl('/a.png')).rejects.toThrow()

    get.mockResolvedValue({ data: new Blob(['bytes']) })
    await expect(loadAvatarObjectUrl('/a.png')).resolves.toBe('blob:one')
    expect(get).toHaveBeenCalledTimes(2)
  })
})

describe('avatarSource', () => {
  it('resolves a server-relative path against the API host', () => {
    expect(avatarSource('/api/v1/users/avatars/1.png')).toBe(
      'https://api.dev.crm-prionex.online/api/v1/users/avatars/1.png'
    )
  })

  it('is undefined when there is no photo', () => {
    expect(avatarSource(null)).toBeUndefined()
    expect(avatarSource(undefined)).toBeUndefined()
  })
})

describe('where the session token is allowed to go', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAvatarCache()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:one')
    get.mockResolvedValue({ data: new Blob(['bytes']) })
  })

  it('fetches our own photos with the client that carries the token', () => {
    expect(
      needsAuthenticatedFetch('https://api.dev.crm-prionex.online/api/v1/users/avatars/1.png')
    ).toBe(true)
  })

  it('will not send credentials to another host', async () => {
    // The API client attaches Authorization and sends cookies to whatever host
    // it is pointed at, and resolveAssetUrl passes an absolute URL through
    // untouched - so a foreign avatar_url must never reach it.
    expect(needsAuthenticatedFetch('https://cdn.example.com/1.png')).toBe(false)

    await expect(loadAvatarObjectUrl('https://cdn.example.com/1.png')).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('treats a data url as foreign too', () => {
    expect(needsAuthenticatedFetch('data:image/png;base64,AAAA')).toBe(false)
  })

  it('does not let one photo end the session or cost three requests', async () => {
    await loadAvatarObjectUrl('/a.png')

    const config = get.mock.calls[0][1]
    // A 401 here means that photo is gone, not that the session is: without
    // this the shared interceptor would clear the token and go to /login.
    expect(config._skipAuthRedirect).toBe(true)
    expect(config._noTransientRetry).toBe(true)
  })
})
