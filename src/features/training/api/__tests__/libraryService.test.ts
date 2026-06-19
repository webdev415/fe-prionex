/**
 * Library service tests (KAN-411 Feature 3.4).
 *
 * Focus on what's brittle about a thin api-client wrapper:
 *
 *   - URLSearchParams construction (multi-value `tag` repeats correctly,
 *     `category` is sent only when present, no stray null/undefined).
 *   - The mutation endpoints hit the right URLs and forward the payload
 *     verbatim so a router-prefix typo gets caught here, not in QA.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import {
  archiveLibraryCall,
  bumpLibraryView,
  createLibraryCall,
  getLibraryCall,
  listLibraryCalls,
  listLibraryTags,
  toggleLibraryHelpful,
  updateLibraryCall,
} from '../libraryService'

const BASE = '/api/v1/quality/library'

describe('libraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listLibraryCalls', () => {
    it('omits params when filters are empty', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listLibraryCalls()

      expect(mockApi.get).toHaveBeenCalledTimes(1)
      const [url, config] = mockApi.get.mock.calls[0]
      expect(url).toBe(BASE)
      expect(config.params.toString()).toBe('')
    })

    it('serialises category, q, and pagination', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listLibraryCalls({
        category: 'ideal',
        q: 'objection',
        limit: 25,
        offset: 50,
      })

      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.get('category')).toBe('ideal')
      expect(params.get('q')).toBe('objection')
      expect(params.get('limit')).toBe('25')
      expect(params.get('offset')).toBe('50')
    })

    it('repeats the tag query param for each value (BE expects ?tag=a&tag=b)', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listLibraryCalls({ tag: ['greeting', 'rebuttal'] })

      const [, config] = mockApi.get.mock.calls[0]
      const params = config.params as URLSearchParams
      expect(params.getAll('tag')).toEqual(['greeting', 'rebuttal'])
    })

    it('returns the response data verbatim', async () => {
      const fake = { data: [{ id: 1 }], total: 1 }
      mockApi.get.mockResolvedValue({ data: fake })
      const result = await listLibraryCalls()
      expect(result).toEqual(fake)
    })
  })

  describe('listLibraryTags', () => {
    it('unwraps the tags array from the response envelope', async () => {
      mockApi.get.mockResolvedValue({
        data: { tags: ['greeting', 'rebuttal'] },
      })
      const tags = await listLibraryTags()
      expect(mockApi.get).toHaveBeenCalledWith(`${BASE}/tags`)
      expect(tags).toEqual(['greeting', 'rebuttal'])
    })
  })

  describe('getLibraryCall', () => {
    it('hits /{id} and returns the card', async () => {
      mockApi.get.mockResolvedValue({ data: { id: 42 } })
      const card = await getLibraryCall(42)
      expect(mockApi.get).toHaveBeenCalledWith(`${BASE}/42`)
      expect(card).toEqual({ id: 42 })
    })
  })

  describe('createLibraryCall', () => {
    it('posts to the collection root with the payload', async () => {
      const payload = {
        call_id: 'abc',
        title: 'Strong opening',
        category: 'ideal' as const,
        tags: ['greeting'],
      }
      mockApi.post.mockResolvedValue({ data: { id: 1, ...payload } })

      const result = await createLibraryCall(payload)
      expect(mockApi.post).toHaveBeenCalledWith(BASE, payload)
      expect(result).toEqual({ id: 1, ...payload })
    })
  })

  describe('updateLibraryCall', () => {
    it('puts to /{id} with the partial payload', async () => {
      const payload = { description: 'updated copy' }
      mockApi.put.mockResolvedValue({ data: { id: 5, ...payload } })
      await updateLibraryCall(5, payload)
      expect(mockApi.put).toHaveBeenCalledWith(`${BASE}/5`, payload)
    })
  })

  describe('archiveLibraryCall', () => {
    it('soft-deletes via DELETE /{id} with no body', async () => {
      mockApi.delete.mockResolvedValue({ data: undefined })
      await archiveLibraryCall(7)
      expect(mockApi.delete).toHaveBeenCalledWith(`${BASE}/7`)
    })
  })

  describe('toggleLibraryHelpful', () => {
    it('posts to /{id}/helpful and returns the toggle response', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          library_call_id: 9,
          voted_helpful: true,
          helpful_count: 4,
        },
      })
      const result = await toggleLibraryHelpful(9)
      expect(mockApi.post).toHaveBeenCalledWith(`${BASE}/9/helpful`)
      expect(result.voted_helpful).toBe(true)
      expect(result.helpful_count).toBe(4)
    })
  })

  describe('bumpLibraryView', () => {
    it('posts to /{id}/view and unwraps the new count', async () => {
      mockApi.post.mockResolvedValue({ data: { view_count: 12 } })
      const count = await bumpLibraryView(9)
      expect(mockApi.post).toHaveBeenCalledWith(`${BASE}/9/view`)
      expect(count).toBe(12)
    })
  })
})
