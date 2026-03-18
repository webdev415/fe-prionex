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
  uploadOperatorAssignment,
  executeOperatorAssignment,
  downloadOperatorAssignmentTemplate,
} from '../operatorAssignmentApi'

describe('operatorAssignmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadOperatorAssignment', () => {
    it('should upload CSV file and return preview response', async () => {
      const mockPreview = {
        job_id: 1,
        batch_id: 'OA-2026-03-12-batch-01',
        filename: 'test.csv',
        status: 'validated',
        total_records: 10,
        summary: { ready: 8, no_change: 1, invalid: 1, unique_operators: 3 },
        preview_rows: [],
        errors: [],
      }
      mockApi.post.mockResolvedValue({ data: mockPreview })

      const file = new File(['client_id,operator_id\n1,2'], 'test.csv', { type: 'text/csv' })
      const result = await uploadOperatorAssignment(file, 1)

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/import/operator-assignment/upload',
        expect.any(FormData),
        expect.objectContaining({
          params: { project_id: 1 },
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer test-token',
          }),
        })
      )
      expect(result).toEqual(mockPreview)
    })

    it('should send file in FormData', async () => {
      mockApi.post.mockResolvedValue({ data: {} })

      const file = new File(['client_id,operator_id\n1,2'], 'test.csv', { type: 'text/csv' })
      await uploadOperatorAssignment(file, 5)

      const formData = mockApi.post.mock.calls[0][1] as FormData
      expect(formData.get('file')).toBe(file)
    })

    it('should propagate API errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Bad Request'))

      const file = new File(['bad'], 'bad.csv', { type: 'text/csv' })
      await expect(uploadOperatorAssignment(file, 1)).rejects.toThrow('Bad Request')
    })
  })

  describe('executeOperatorAssignment', () => {
    it('should execute a validated job', async () => {
      const mockResponse = { job_id: 1, status: 'processing', message: 'Job queued' }
      mockApi.post.mockResolvedValue({ data: mockResponse })

      const result = await executeOperatorAssignment(1, {
        assignment_reason: 'March redistribution',
      })

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/import/operator-assignment/1/execute', {
        assignment_reason: 'March redistribution',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should send empty object when no request body', async () => {
      mockApi.post.mockResolvedValue({ data: { job_id: 1, status: 'processing', message: 'ok' } })

      await executeOperatorAssignment(1)

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/import/operator-assignment/1/execute', {})
    })

    it('should propagate 409 conflict errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Validation expired'))

      await expect(executeOperatorAssignment(1)).rejects.toThrow('Validation expired')
    })
  })

  describe('downloadOperatorAssignmentTemplate', () => {
    it('should download CSV template as blob', async () => {
      const mockBlob = new Blob(['client_id,operator_id\n'], { type: 'text/csv' })
      mockApi.get.mockResolvedValue({ data: mockBlob })

      const result = await downloadOperatorAssignmentTemplate()

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/import/operator-assignment/template', {
        responseType: 'blob',
      })
      expect(result).toBe(mockBlob)
    })
  })
})
