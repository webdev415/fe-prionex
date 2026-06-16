/**
 * Leaderboard service tests (KAN-411 Feature 3.2).
 *
 * Tight coverage on:
 *   - `refresh=true` actually rides through to the request when set.
 *   - Manual badge award POSTs the full payload (badge_code + optional
 *     metadata) so the BE can correlate.
 *   - The .xlsx URL builder is deterministic per period (used as a
 *     plain anchor href in the FE, not via an api.get call).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import {
  awardBadgeManually,
  getLeaderboard,
  getOperatorBadges,
  leaderboardExportUrl,
  listBadgeDefinitions,
} from '../leaderboardService'

const BASE = '/api/v1/quality'

describe('leaderboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getLeaderboard', () => {
    it('omits period and refresh by default', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          project_id: 1,
          period: 'week',
          period_start: '2026-06-01',
          period_end: '2026-06-07',
          computed_at: '2026-06-01T12:00:00Z',
          ranking: [],
        },
      })
      await getLeaderboard()
      const [url, config] = mockApi.get.mock.calls[0]
      expect(url).toBe(`${BASE}/leaderboard`)
      expect(config.params.toString()).toBe('')
    })

    it('forwards period and refresh=true when set', async () => {
      mockApi.get.mockResolvedValue({ data: { ranking: [] } })
      await getLeaderboard({ period: 'month', refresh: true })
      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.get('period')).toBe('month')
      expect(params.get('refresh')).toBe('true')
    })

    it('omits refresh when false (keeps cache path clean)', async () => {
      mockApi.get.mockResolvedValue({ data: { ranking: [] } })
      await getLeaderboard({ period: 'week', refresh: false })
      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.get('refresh')).toBeNull()
    })
  })

  describe('getOperatorBadges', () => {
    it('unwraps the data envelope', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [{ id: 1 }] } })
      const badges = await getOperatorBadges(42)
      expect(mockApi.get).toHaveBeenCalledWith(`${BASE}/operators/42/badges`)
      expect(badges).toEqual([{ id: 1 }])
    })
  })

  describe('listBadgeDefinitions', () => {
    it('unwraps the data envelope', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [{ code: 'x' }] } })
      const defs = await listBadgeDefinitions()
      expect(mockApi.get).toHaveBeenCalledWith(`${BASE}/badges/definitions`)
      expect(defs).toEqual([{ code: 'x' }])
    })
  })

  describe('awardBadgeManually', () => {
    it('posts the full payload', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 99 } })
      const payload = {
        operator_id: 7,
        badge_code: 'best_call_of_week',
        metadata: { note: 'great rebuttal' },
      }
      const result = await awardBadgeManually(payload)
      expect(mockApi.post).toHaveBeenCalledWith(`${BASE}/badges/award`, payload)
      expect(result).toEqual({ id: 99 })
    })
  })

  describe('leaderboardExportUrl', () => {
    it('builds a deterministic URL per period', () => {
      expect(leaderboardExportUrl('week')).toBe(`${BASE}/leaderboard/export.xlsx?period=week`)
      expect(leaderboardExportUrl('month')).toBe(`${BASE}/leaderboard/export.xlsx?period=month`)
    })
  })
})
