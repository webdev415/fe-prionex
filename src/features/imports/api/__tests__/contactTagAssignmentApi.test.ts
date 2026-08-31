import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

const mockToken = vi.hoisted(() => ({ value: 'test-token' as string | null }))

vi.mock('@/lib/api', () => ({
  default: mockApi,
  getAccessToken: () => mockToken.value,
}))

import { uploadContactTagAssignment, executeContactTagAssignment } from '../contactTagAssignmentApi'

const csv = () =>
  new File(['tin,contact_value,category,tag\n123,380501234567,Messengers,Telegram'], 'tags.csv', {
    type: 'text/csv',
  })

describe('contactTagAssignmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToken.value = 'test-token'
  })

  describe('uploadContactTagAssignment', () => {
    it('posts to the contact-tag endpoint with project_id and mode as query params', async () => {
      mockApi.post.mockResolvedValue({ data: { job_id: 7 } })

      const result = await uploadContactTagAssignment(csv(), 3, 'assign')

      expect(mockApi.post).toHaveBeenCalledTimes(1)
      const [url, body, config] = mockApi.post.mock.calls[0]
      expect(url).toBe('/api/v1/import/contact-tag-assignment/upload')
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('file')).toBeInstanceOf(File)
      // mode is a query param, not a body field — the endpoint reads it from
      // the querystring, so sending it in the form silently defaults to assign.
      expect(config.params).toEqual({ project_id: 3, mode: 'assign' })
      expect(result).toEqual({ job_id: 7 })
    })

    it('carries the remove mode through', async () => {
      mockApi.post.mockResolvedValue({ data: {} })
      await uploadContactTagAssignment(csv(), 1, 'remove')
      expect(mockApi.post.mock.calls[0][2].params.mode).toBe('remove')
    })

    it('sets multipart and the bearer token', async () => {
      mockApi.post.mockResolvedValue({ data: {} })
      await uploadContactTagAssignment(csv(), 1, 'assign')
      const { headers } = mockApi.post.mock.calls[0][2]
      expect(headers['Content-Type']).toBe('multipart/form-data')
      expect(headers.Authorization).toBe('Bearer test-token')
    })

    it('fails before the request when there is no token', async () => {
      // Uploading without one produces a 401 the operator cannot act on; this
      // turns it into a message that names the cause.
      mockToken.value = null
      await expect(uploadContactTagAssignment(csv(), 1, 'assign')).rejects.toThrow(
        /Authentication token/i
      )
      expect(mockApi.post).not.toHaveBeenCalled()
    })
  })

  describe('executeContactTagAssignment', () => {
    it('posts to the job-scoped execute path', async () => {
      mockApi.post.mockResolvedValue({ data: { status: 'processing' } })

      const result = await executeContactTagAssignment(42)

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/import/contact-tag-assignment/42/execute',
        {}
      )
      expect(result).toEqual({ status: 'processing' })
    })

    it('forwards the request body when one is given', async () => {
      mockApi.post.mockResolvedValue({ data: {} })
      await executeContactTagAssignment(42, { skip_warnings: true })
      expect(mockApi.post.mock.calls[0][1]).toEqual({ skip_warnings: true })
    })
  })
})
