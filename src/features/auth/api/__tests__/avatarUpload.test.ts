/**
 * The avatar request itself, below the component.
 *
 * The shared axios instance sets `Content-Type: application/json` on every
 * request (src/lib/api.ts). Sent as-is with a FormData body, the browser never
 * adds the multipart boundary, so the server receives no `file` field and
 * answers 422 "Field required". Component tests cannot see this: they mock
 * authApi, so the request is never built.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mockApi, default: mockApi }))

const { authApi } = await import('../authApi')

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.post.mockResolvedValue({ data: {} })
  })

  it('posts to the avatar endpoint', async () => {
    await authApi.uploadAvatar(new File(['x'], 'me.png', { type: 'image/png' }))

    expect(mockApi.post.mock.calls[0][0]).toBe('/api/v1/users/me/avatar')
  })

  it('sends the file as multipart, not JSON', async () => {
    await authApi.uploadAvatar(new File(['x'], 'me.png', { type: 'image/png' }))

    const [, body, config] = mockApi.post.mock.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data')
  })

  it('names the part "file", which is what the endpoint reads', async () => {
    const file = new File(['x'], 'me.png', { type: 'image/png' })

    await authApi.uploadAvatar(file)

    const body = mockApi.post.mock.calls[0][1] as FormData
    expect(body.get('file')).toBe(file)
  })
})

describe('deleteAvatar', () => {
  it('deletes the avatar endpoint', async () => {
    vi.clearAllMocks()
    mockApi.delete.mockResolvedValue({ data: {} })

    await authApi.deleteAvatar()

    expect(mockApi.delete.mock.calls[0][0]).toBe('/api/v1/users/me/avatar')
  })
})
