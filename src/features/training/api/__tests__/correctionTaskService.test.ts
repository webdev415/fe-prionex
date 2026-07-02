import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getCorrectionTaskByFeedback } from '../correctionTaskService'

const BASE = '/api/v1/tasks/correction'

describe('getCorrectionTaskByFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the linked task on 200', async () => {
    mockApi.get.mockResolvedValue({ data: { id: 5, status: 'completed' } })
    const task = await getCorrectionTaskByFeedback(4242)
    expect(mockApi.get).toHaveBeenCalledWith(`${BASE}/by-feedback/4242`)
    expect(task).toEqual({ id: 5, status: 'completed' })
  })

  it('resolves to null on 404 (no task linked yet)', async () => {
    mockApi.get.mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
    const task = await getCorrectionTaskByFeedback(999)
    expect(task).toBeNull()
  })

  it('re-throws non-404 errors', async () => {
    mockApi.get.mockRejectedValue({ isAxiosError: true, response: { status: 500 } })
    await expect(getCorrectionTaskByFeedback(1)).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
