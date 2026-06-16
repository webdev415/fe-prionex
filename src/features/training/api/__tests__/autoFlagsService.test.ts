/**
 * Auto-flags service tests (KAN-411 Feature 3.3).
 *
 * Focus on:
 *   - listFlags query-string serialisation, including the multi-value
 *     `operator_id` repeat.
 *   - The two flag-state transitions (confirm / dismiss) hit the right
 *     URL and forward the optional reason.
 *   - bulk-dismiss + convert-to-task carry the right payload shape so
 *     BE-side `rule_code` / `due_date` parsing stays in sync.
 *   - The rules CRUD endpoints route to analytics-service, not quality
 *     (catches a base-URL regression that would silently 404).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import {
  bulkDismissFlags,
  confirmFlag,
  convertFlagToTask,
  dismissFlag,
  getUnreviewedCount,
  listAutoFlagRules,
  listFlags,
  updateAutoFlagRule,
} from '../autoFlagsService'

const QUALITY = '/api/v1/quality'
const ANALYTICS = '/api/v1/analytics'

describe('autoFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listFlags', () => {
    it('omits all params when no filters supplied', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listFlags()
      const [url, config] = mockApi.get.mock.calls[0]
      expect(url).toBe(`${QUALITY}/flags`)
      expect(config.params.toString()).toBe('')
    })

    it('serialises status + rule_code + pagination', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listFlags({
        status: 'pending',
        rule_code: 'fast_result',
        limit: 50,
        offset: 100,
      })
      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.get('status')).toBe('pending')
      expect(params.get('rule_code')).toBe('fast_result')
      expect(params.get('limit')).toBe('50')
      expect(params.get('offset')).toBe('100')
    })

    it('repeats operator_id for each value', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listFlags({ operator_id: [1, 2, 3] })
      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.getAll('operator_id')).toEqual(['1', '2', '3'])
    })
  })

  describe('getUnreviewedCount', () => {
    it('unwraps the count from the envelope', async () => {
      mockApi.get.mockResolvedValue({ data: { count: 4 } })
      const count = await getUnreviewedCount()
      expect(mockApi.get).toHaveBeenCalledWith(`${QUALITY}/flags/unreviewed-count`)
      expect(count).toBe(4)
    })
  })

  describe('confirmFlag', () => {
    it('posts to /flags/{id}/confirm with no body', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, status: 'confirmed' } })
      await confirmFlag(1)
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/1/confirm`)
    })
  })

  describe('dismissFlag', () => {
    it('forwards the optional reason in the body', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, status: 'dismissed' } })
      await dismissFlag(1, { reason: 'False positive' })
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/1/dismiss`, {
        reason: 'False positive',
      })
    })

    it('defaults to an empty body when no reason given', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, status: 'dismissed' } })
      await dismissFlag(1)
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/1/dismiss`, {})
    })
  })

  describe('bulkDismissFlags', () => {
    it('sends rule_code + optional window', async () => {
      mockApi.post.mockResolvedValue({
        data: { rule_code: 'fast_result', dismissed_count: 4 },
      })
      const result = await bulkDismissFlags({
        rule_code: 'fast_result',
        period_from: '2026-06-01T00:00:00Z',
        period_to: '2026-06-07T23:59:59Z',
      })
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/bulk-dismiss`, {
        rule_code: 'fast_result',
        period_from: '2026-06-01T00:00:00Z',
        period_to: '2026-06-07T23:59:59Z',
      })
      expect(result.dismissed_count).toBe(4)
    })
  })

  describe('convertFlagToTask', () => {
    it('posts to /flags/{id}/convert-to-task with the overrides', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, status: 'confirmed' } })
      await convertFlagToTask(1, {
        title: 'Custom title',
        due_date: '2026-06-10T00:00:00Z',
      })
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/1/convert-to-task`, {
        title: 'Custom title',
        due_date: '2026-06-10T00:00:00Z',
      })
    })

    it('sends an empty body when no overrides given', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1 } })
      await convertFlagToTask(1)
      expect(mockApi.post).toHaveBeenCalledWith(`${QUALITY}/flags/1/convert-to-task`, {})
    })
  })

  describe('listAutoFlagRules', () => {
    it('hits the analytics service, not quality', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [{ code: 'x' }] } })
      await listAutoFlagRules()
      expect(mockApi.get).toHaveBeenCalledWith(`${ANALYTICS}/auto-flag-rules`)
    })
  })

  describe('updateAutoFlagRule', () => {
    it('hits the analytics service for the PUT', async () => {
      mockApi.put.mockResolvedValue({
        data: { id: 5, is_enabled: false, thresholds: {} },
      })
      await updateAutoFlagRule(5, { is_enabled: false })
      expect(mockApi.put).toHaveBeenCalledWith(`${ANALYTICS}/auto-flag-rules/5`, {
        is_enabled: false,
      })
    })
  })
})
