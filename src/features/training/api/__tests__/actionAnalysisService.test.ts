/**
 * Service-level coverage for the Interactions param builder used by the
 * Action Analysis Interactions sub-tab (KAN-731 Block 1 + Phase B).
 *
 * The handler accepts `department_id` / `group_id` as the new trainer-scope
 * params — those flow through the FE service unchanged. Existing
 * `user_ids` / `period` / `result_ids` semantics are preserved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import {
  getInteractionMonitoring,
  getPromisesAndCallbacks,
  getWeeklyBucket,
} from '../actionAnalysisService'

describe('getInteractionMonitoring — param builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, page_size: 50 } })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getParams(): URLSearchParams {
    const [, config] = mockApi.get.mock.calls[0]
    return config.params as URLSearchParams
  }

  it('hits /api/v1/interactions and omits all optional params by default', async () => {
    await getInteractionMonitoring({})
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/interactions', expect.any(Object))
    expect(getParams().toString()).toBe('')
  })

  it('forwards department_id as a scalar param (KAN-731 Phase B)', async () => {
    await getInteractionMonitoring({ department_id: 7 })
    expect(getParams().get('department_id')).toBe('7')
    expect(getParams().get('group_id')).toBeNull()
  })

  it('forwards group_id as a scalar param (KAN-731 Phase B)', async () => {
    await getInteractionMonitoring({ group_id: 3 })
    expect(getParams().get('group_id')).toBe('3')
    expect(getParams().get('department_id')).toBeNull()
  })

  it('does NOT emit scope params when not provided', async () => {
    await getInteractionMonitoring({ period: 'today', user_ids: [1, 2] })
    const params = getParams()
    expect(params.get('department_id')).toBeNull()
    expect(params.get('group_id')).toBeNull()
  })

  it('repeats user_ids as multiple params, matching FastAPI Query(List[int])', async () => {
    await getInteractionMonitoring({ user_ids: [10, 20, 30] })
    const all = getParams().getAll('user_ids')
    expect(all).toEqual(['10', '20', '30'])
  })

  it('forwards period + sort + page params untouched', async () => {
    await getInteractionMonitoring({
      period: 'today',
      sort_by: 'date',
      sort_dir: 'desc',
      page: 2,
      page_size: 25,
    })
    const params = getParams()
    expect(params.get('period')).toBe('today')
    expect(params.get('sort_by')).toBe('date')
    expect(params.get('sort_dir')).toBe('desc')
    expect(params.get('page')).toBe('2')
    expect(params.get('page_size')).toBe('25')
  })

  it('combines scope + filter params without conflict', async () => {
    await getInteractionMonitoring({
      department_id: 7,
      user_ids: [10, 20],
      result_ids: [5],
      period: 'last_7d',
    })
    const params = getParams()
    expect(params.get('department_id')).toBe('7')
    expect(params.getAll('user_ids')).toEqual(['10', '20'])
    expect(params.getAll('result_ids')).toEqual(['5'])
    expect(params.get('period')).toBe('last_7d')
  })
})

describe('getPromisesAndCallbacks — param builder (KAN-733)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({
      data: {
        summary_cards: {
          total_promises_amount: '0',
          paid_amount: '0',
          overdue_count: 0,
          pending_amount: '0',
        },
        items: [],
        total: 0,
        page: 1,
        page_size: 50,
      },
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getParams(): URLSearchParams {
    const [, config] = mockApi.get.mock.calls[0]
    return config.params as URLSearchParams
  }

  it('hits the promises-and-callbacks endpoint and omits optional params by default', async () => {
    await getPromisesAndCallbacks({})
    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/interactions/promises-and-callbacks',
      expect.any(Object)
    )
    expect(getParams().toString()).toBe('')
  })

  it('repeats user_ids and forwards scope params', async () => {
    await getPromisesAndCallbacks({ user_ids: [10, 20], department_id: 7 })
    const params = getParams()
    expect(params.getAll('user_ids')).toEqual(['10', '20'])
    expect(params.get('department_id')).toBe('7')
  })

  it('forwards period + sort + pagination', async () => {
    await getPromisesAndCallbacks({
      period: 'today',
      sort_by: 'amount',
      sort_dir: 'asc',
      page: 2,
      page_size: 25,
    })
    const params = getParams()
    expect(params.get('period')).toBe('today')
    expect(params.get('sort_by')).toBe('amount')
    expect(params.get('sort_dir')).toBe('asc')
    expect(params.get('page')).toBe('2')
    expect(params.get('page_size')).toBe('25')
  })
})

describe('getWeeklyBucket — param builder (KAN-732)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({
      data: { buckets: [], totals: { today: 0, this_week: 0, overdue: 0 }, no_due_date: 0 },
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getParams(): URLSearchParams {
    const [, config] = mockApi.get.mock.calls[0]
    return config.params as URLSearchParams
  }

  it('hits /api/v1/tasks/weekly-bucket and omits optional params by default', async () => {
    await getWeeklyBucket({})
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/tasks/weekly-bucket', expect.any(Object))
    expect(getParams().toString()).toBe('')
  })

  it('forwards from_date / to_date window', async () => {
    await getWeeklyBucket({ from_date: '2026-01-05T00:00:00', to_date: '2026-01-12T00:00:00' })
    const params = getParams()
    expect(params.get('from_date')).toBe('2026-01-05T00:00:00')
    expect(params.get('to_date')).toBe('2026-01-12T00:00:00')
  })

  it('repeats operator_ids / status_in / priority_in for FastAPI Query(List)', async () => {
    await getWeeklyBucket({
      operator_ids: [10, 20],
      status_in: ['pending', 'in_progress'],
      priority_in: ['high'],
    })
    const params = getParams()
    expect(params.getAll('operator_ids')).toEqual(['10', '20'])
    expect(params.getAll('status_in')).toEqual(['pending', 'in_progress'])
    expect(params.getAll('priority_in')).toEqual(['high'])
  })

  it('emits include_no_due_date only when truthy', async () => {
    await getWeeklyBucket({ include_no_due_date: true })
    expect(getParams().get('include_no_due_date')).toBe('true')
  })

  it('omits include_no_due_date when false', async () => {
    await getWeeklyBucket({ include_no_due_date: false })
    expect(getParams().get('include_no_due_date')).toBeNull()
  })
})
