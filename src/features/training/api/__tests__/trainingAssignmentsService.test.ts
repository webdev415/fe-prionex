import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listAssignments, updateAssignmentDeadline } from '../trainingAssignmentsService'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: mockApi }))

describe('trainingAssignmentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listAssignments', () => {
    it('builds params, dropping unset filters', async () => {
      mockApi.get.mockResolvedValue({
        data: { rows: [], kpis: { total_active: 0, completed: 0, overdue: 0 }, total: 0 },
      })
      await listAssignments({ operator_id: 7, status: 'overdue', q: 'onboarding', limit: 100 })

      const [url, config] = mockApi.get.mock.calls[0]
      expect(url).toBe('/api/v1/quality/course-assignments')
      const params = config.params as URLSearchParams
      expect(params.get('operator_id')).toBe('7')
      expect(params.get('status')).toBe('overdue')
      expect(params.get('q')).toBe('onboarding')
      expect(params.get('limit')).toBe('100')
    })

    it('omits filters that are not set', async () => {
      mockApi.get.mockResolvedValue({
        data: { rows: [], kpis: { total_active: 0, completed: 0, overdue: 0 }, total: 0 },
      })
      await listAssignments({})
      const params = mockApi.get.mock.calls[0][1].params as URLSearchParams
      expect(params.toString()).toBe('')
    })
  })

  describe('updateAssignmentDeadline', () => {
    it('PATCHes the enrollment with the deadline', async () => {
      mockApi.patch.mockResolvedValue({ data: { enrollment_id: 5 } })
      await updateAssignmentDeadline(5, '2026-08-01T23:59:59.000Z')
      expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/quality/course-assignments/5', {
        deadline: '2026-08-01T23:59:59.000Z',
      })
    })

    it('sends null to clear the deadline', async () => {
      mockApi.patch.mockResolvedValue({ data: { enrollment_id: 5 } })
      await updateAssignmentDeadline(5, null)
      expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/quality/course-assignments/5', {
        deadline: null,
      })
    })
  })
})
