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

const { avatarSource, clearAvatarCache, loadAvatarObjectUrl } = await import('../avatarImage')

describe('loadAvatarObjectUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAvatarCache()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:one')
    get.mockResolvedValue({ data: new Blob(['bytes']) })
  })

  it('asks the API client, so the request carries the token', async () => {
    await loadAvatarObjectUrl('https://api.example.com/api/v1/users/avatars/1.png')

    expect(get).toHaveBeenCalledWith('https://api.example.com/api/v1/users/avatars/1.png', {
      responseType: 'blob',
    })
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
