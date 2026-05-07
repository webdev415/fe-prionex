import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  default: mockApi,
  getAccessToken: () => 'test-token',
}))

import {
  uploadTagAssignment,
  executeTagAssignment,
  downloadTagAssignmentTemplate,
} from '../tagAssignmentApi'

describe('tagAssignmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadTagAssignment', () => {
    it('should upload CSV file and return preview response', async () => {
      const mockPreview = {
        job_id: 1,
        batch_id: 'TA-2026-05-06-batch-01',
        filename: 'test.csv',
        status: 'validated',
        mode: 'assign',
        total_records: 3,
        summary: { ready: 2, no_change: 0, invalid: 1, unique_tags: 2, unique_clients: 3 },
        preview_rows: [],
        errors: [],
      }
      mockApi.post.mockResolvedValue({ data: mockPreview })

      const file = new File(['tax_id,tags\n1234,VIP'], 'test.csv', { type: 'text/csv' })
      const result = await uploadTagAssignment(file, 1, 'assign')

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/import/tag-assignment/upload',
        expect.any(FormData),
        expect.objectContaining({
          params: { project_id: 1, mode: 'assign' },
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer test-token',
          }),
        })
      )
      expect(result).toEqual(mockPreview)
    })

    it('forwards the remove mode in the query string', async () => {
      mockApi.post.mockResolvedValue({ data: {} })

      const file = new File(['tax_id,tags\n1234,VIP'], 'test.csv', { type: 'text/csv' })
      await uploadTagAssignment(file, 7, 'remove')

      const call = mockApi.post.mock.calls[0]
      expect(call[2].params).toEqual({ project_id: 7, mode: 'remove' })
    })

    it('puts the file in FormData', async () => {
      mockApi.post.mockResolvedValue({ data: {} })

      const file = new File(['tax_id,tags\n1234,VIP'], 'test.csv', { type: 'text/csv' })
      await uploadTagAssignment(file, 1, 'assign')

      const formData = mockApi.post.mock.calls[0][1] as FormData
      expect(formData.get('file')).toBe(file)
    })

    it('propagates API errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Bad Request'))

      const file = new File(['bad'], 'bad.csv', { type: 'text/csv' })
      await expect(uploadTagAssignment(file, 1, 'assign')).rejects.toThrow('Bad Request')
    })
  })

  describe('executeTagAssignment', () => {
    it('executes a validated job with skip_warnings', async () => {
      const mockResponse = { job_id: 1, status: 'processing', message: 'Job queued' }
      mockApi.post.mockResolvedValue({ data: mockResponse })

      const result = await executeTagAssignment(1, { skip_warnings: true })

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/import/tag-assignment/1/execute', {
        skip_warnings: true,
      })
      expect(result).toEqual(mockResponse)
    })

    it('sends empty object when no request body', async () => {
      mockApi.post.mockResolvedValue({
        data: { job_id: 1, status: 'processing', message: 'ok' },
      })
      await executeTagAssignment(1)
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/import/tag-assignment/1/execute', {})
    })

    it('propagates errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Validation expired'))
      await expect(executeTagAssignment(1)).rejects.toThrow('Validation expired')
    })
  })

  describe('downloadTagAssignmentTemplate', () => {
    it('downloads the template as a blob', async () => {
      const mockBlob = new Blob(['tax_id,tags\n'], { type: 'text/csv' })
      mockApi.get.mockResolvedValue({ data: mockBlob })

      const result = await downloadTagAssignmentTemplate()

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/import/tag-assignment/template', {
        responseType: 'blob',
      })
      expect(result).toBe(mockBlob)
    })
  })
})
