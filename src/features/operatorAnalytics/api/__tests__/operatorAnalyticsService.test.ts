/**
 * Service-level coverage for the shared range param builder used by the
 * operator-analytics surfaces (Screen Time, Heatmap). Exercises `department_ids`
 * as a repeated param alongside `operator_ids` / `period` / `from_date` / `to_date`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getScreenTime, exportScreenTime } from '../operatorAnalyticsService'

describe('getScreenTime — range param builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({
      data: { period_from: '', period_to: '', operators: [], benchmark_metric: '' },
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getParams(): URLSearchParams {
    const [, config] = mockApi.get.mock.calls[0]
    return config.params as URLSearchParams
  }

  it('hits /api/v1/analytics/screen-time and omits optional params by default', async () => {
    await getScreenTime({})
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/analytics/screen-time', expect.any(Object))
    expect(getParams().toString()).toBe('')
  })

  it('repeats department_ids as multiple params, matching FastAPI Query(List[int])', async () => {
    await getScreenTime({ department_ids: [10, 20] })
    expect(getParams().getAll('department_ids')).toEqual(['10', '20'])
  })

  it('does NOT emit department_ids when not provided', async () => {
    await getScreenTime({ period: 'today' })
    expect(getParams().getAll('department_ids')).toEqual([])
    expect(getParams().get('period')).toBe('today')
  })

  it('repeats operator_ids and department_ids together without conflict', async () => {
    await getScreenTime({ operator_ids: [1, 2], department_ids: [7] })
    const params = getParams()
    expect(params.getAll('operator_ids')).toEqual(['1', '2'])
    expect(params.getAll('department_ids')).toEqual(['7'])
  })

  it('forwards period + from_date / to_date window untouched', async () => {
    await getScreenTime({
      period: 'custom',
      from_date: '2026-01-05T00:00:00',
      to_date: '2026-01-12T00:00:00',
    })
    const params = getParams()
    expect(params.get('period')).toBe('custom')
    expect(params.get('from_date')).toBe('2026-01-05T00:00:00')
    expect(params.get('to_date')).toBe('2026-01-12T00:00:00')
  })
})

describe('exportScreenTime — range param builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: new Blob() })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getParams(): URLSearchParams {
    const [, config] = mockApi.get.mock.calls[0]
    return config.params as URLSearchParams
  }

  it('hits the export endpoint as a blob and forwards department_ids', async () => {
    await exportScreenTime({ department_ids: [7] })
    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/analytics/screen-time/export',
      expect.objectContaining({ responseType: 'blob' })
    )
    expect(getParams().getAll('department_ids')).toEqual(['7'])
  })
})
