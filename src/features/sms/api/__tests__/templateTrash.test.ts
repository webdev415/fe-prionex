/**
 * Trash and restore for SMS templates.
 *
 * These endpoints have existed on the backend since soft delete shipped, but
 * nothing in the SPA called them: deleting a template was a one-way door for
 * the user even though the row survived for the whole retention window.
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

const { getDeletedTemplates, restoreTemplate, deleteTemplate } = await import('../smsApi')

describe('getDeletedTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { total: 0, templates: [] } })
  })

  it('reads the trash endpoint', async () => {
    await getDeletedTemplates()
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/sms/templates/trash', {
      params: undefined,
    })
  })

  it('forwards category and pagination', async () => {
    await getDeletedTemplates({ category: 'reminder', limit: 25, offset: 50 })
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/sms/templates/trash', {
      params: { category: 'reminder', limit: 25, offset: 50 },
    })
  })

  it('returns the paginated envelope, not a bare array', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        total: 12,
        templates: [
          {
            id: 3,
            name: 'gone',
            is_deleted: true,
            deleted_at: '2026-08-01T10:00:00Z',
            deleted_by: 42,
          },
        ],
      },
    })

    const page = await getDeletedTemplates({ limit: 1 })

    expect(page.total).toBe(12)
    expect(page.templates).toHaveLength(1)
    expect(page.templates[0].deleted_at).toBe('2026-08-01T10:00:00Z')
    expect(page.templates[0].deleted_by).toBe(42)
  })
})

describe('restoreTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.post.mockResolvedValue({ data: { id: 3, name: 'back' } })
  })

  it('posts to the restore endpoint for that template', async () => {
    await restoreTemplate(3)
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/sms/templates/3/restore')
  })

  it('returns the revived template', async () => {
    const restored = await restoreTemplate(3)
    expect(restored.id).toBe(3)
  })
})

describe('deleteTemplate', () => {
  it('still hits the soft-delete endpoint, which is what makes restore possible', async () => {
    vi.clearAllMocks()
    mockApi.delete.mockResolvedValue({})

    await deleteTemplate(9)

    expect(mockApi.delete).toHaveBeenCalledWith('/api/v1/sms/templates/9')
  })
})
