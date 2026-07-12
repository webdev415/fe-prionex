/**
 * Service-level coverage for the Trainings & Sessions surfaces wired in
 * KAN-750 (Courses), KAN-751 (Drill Exercises), KAN-752 (Group Training
 * Sessions). Verifies endpoint paths + list param building + key mutation
 * bodies against the quality-service contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: mockApi, default: mockApi }))

import { listCourses, enrollOperators } from '../coursesService'
import { listDrills, transitionAttempt, assignDrill } from '../drillsService'
import { listGroupTrainings, registerForTraining } from '../groupTrainingsService'

function getParams(call: number = 0): URLSearchParams {
  const [, config] = mockApi.get.mock.calls[call]
  return config.params as URLSearchParams
}

describe('coursesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
    mockApi.post.mockResolvedValue({ data: { enrollments: [] } })
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists courses at the right path and forwards status + q', async () => {
    await listCourses({ status: 'published', q: 'sales' })
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/quality/courses', expect.any(Object))
    expect(getParams().get('status')).toBe('published')
    expect(getParams().get('q')).toBe('sales')
  })

  it('enrolls operators via the enroll endpoint with operator_ids body', async () => {
    await enrollOperators(7, [10, 20])
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/quality/courses/7/enroll', {
      operator_ids: [10, 20],
      start_date: null,
    })
  })
})

describe('drillsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
    mockApi.post.mockResolvedValue({ data: {} })
    mockApi.patch.mockResolvedValue({ data: {} })
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists drills and forwards status, category, and skill_level filters', async () => {
    await listDrills({ status: 'active', category: 'opening', skill_level: 'beginner' })
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/quality/drills', expect.any(Object))
    expect(getParams().get('status')).toBe('active')
    expect(getParams().get('category')).toBe('opening')
    expect(getParams().get('skill_level')).toBe('beginner')
  })

  it('transitions an attempt via the transition endpoint', async () => {
    await transitionAttempt(42, { to_status: 'confirmed' })
    expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/quality/drill-attempts/42/transition', {
      to_status: 'confirmed',
    })
  })

  it('assigns a drill with operator_ids, deadline, and note', async () => {
    await assignDrill(5, { operator_ids: [1, 2], deadline: null, note: 'go' })
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/quality/drills/5/assign', {
      operator_ids: [1, 2],
      deadline: null,
      note: 'go',
    })
  })
})

describe('groupTrainingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
    mockApi.post.mockResolvedValue({ data: {} })
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists group trainings and forwards the status filter', async () => {
    await listGroupTrainings({ status: 'scheduled' })
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/quality/group-trainings', expect.any(Object))
    expect(getParams().get('status')).toBe('scheduled')
  })

  it('registers for a training via the register endpoint', async () => {
    await registerForTraining(3)
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/quality/group-trainings/3/register')
  })
})
