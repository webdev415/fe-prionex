/**
 * Trash and restore for messaging drafts.
 *
 * The endpoints existed but nothing in the SPA called them. The trash listing
 * gained limit/offset on the backend so it matches the SMS template envelope
 * and one component can render both.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

const { messagingApi } = await import('../messagingApi')

describe('listDeletedDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { total: 0, drafts: [] } })
  })

  it('reads the drafts trash endpoint', async () => {
    await messagingApi.listDeletedDrafts()
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/messaging/drafts/trash', {
      params: undefined,
    })
  })

  it('forwards channel and pagination', async () => {
    await messagingApi.listDeletedDrafts({ channel: 'viber', limit: 10, offset: 20 })
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/messaging/drafts/trash', {
      params: { channel: 'viber', limit: 10, offset: 20 },
    })
  })

  // Backend and frontend deploy separately. These two cover the rollout window
  // where an older messaging-service still serves the pre-envelope shape: the
  // trash must come back empty (or best-effort), never crash a consumer that
  // calls .map on undefined.
  it('survives a backend still returning the old bare array', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 5, name: 'gone' }] })

    const page = await messagingApi.listDeletedDrafts()

    expect(page.total).toBe(1)
    expect(page.drafts).toHaveLength(1)
    expect(Array.isArray(page.drafts)).toBe(true)
  })

  it('degrades to an empty page when the envelope is missing its field', async () => {
    mockApi.get.mockResolvedValue({ data: { total: 3 } })

    const page = await messagingApi.listDeletedDrafts()

    expect(page.drafts).toEqual([])
    expect(Array.isArray(page.drafts)).toBe(true)
  })

  it('returns total alongside the page, so paging is possible', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        total: 7,
        drafts: [
          {
            id: 5,
            name: 'gone',
            is_deleted: true,
            deleted_at: '2026-08-02T09:00:00Z',
            deleted_by: 11,
          },
        ],
      },
    })

    const page = await messagingApi.listDeletedDrafts({ limit: 1 })

    expect(page.total).toBe(7)
    expect(page.drafts).toHaveLength(1)
    expect(page.drafts[0].deleted_at).toBe('2026-08-02T09:00:00Z')
  })
})

describe('restoreDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.post.mockResolvedValue({ data: { id: 5, name: 'back' } })
  })

  it('posts to the restore endpoint for that draft', async () => {
    await messagingApi.restoreDraft(5)
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/messaging/drafts/5/restore')
  })

  it('returns the revived draft', async () => {
    const restored = await messagingApi.restoreDraft(5)
    expect(restored.id).toBe(5)
  })
})
