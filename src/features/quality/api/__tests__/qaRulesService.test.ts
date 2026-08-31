/**
 * qaRulesService — query building and response shaping.
 *
 * These are the places the FE/BE contract bites: `is_active` is a tri-state
 * that overrides `include_inactive` (so `false` must reach the wire and an
 * unset value must not), the list answers a bare array, and the rubric list
 * must never fall back to the endpoint's `manual` default.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { listQaBlockers, listQaTemplates } from '../qaRulesService'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

const mockGet = vi.mocked(api.get)

/** The URLSearchParams the service handed to axios, as a plain string. */
function sentQuery(): string {
  const config = mockGet.mock.calls[0][1] as { params: URLSearchParams }
  return config.params.toString()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: [] } as never)
})

describe('listQaBlockers', () => {
  it('sends nothing when no filter is set', async () => {
    await listQaBlockers()
    expect(sentQuery()).toBe('')
  })

  it('asks for both states with include_inactive and no is_active', async () => {
    await listQaBlockers({ include_inactive: true })
    expect(sentQuery()).toBe('include_inactive=true')
  })

  it('sends is_active=false rather than dropping the falsy value', async () => {
    await listQaBlockers({ is_active: false })
    expect(sentQuery()).toBe('is_active=false')
  })

  it('serialises the vocabulary filters', async () => {
    await listQaBlockers({ category: 'threat', severity: 'critical', lang: 'uk' })
    expect(sentQuery()).toBe('category=threat&severity=critical&lang=uk')
  })

  it('tolerates a non-array body instead of crashing the table', async () => {
    mockGet.mockResolvedValue({ data: null } as never)
    await expect(listQaBlockers()).resolves.toEqual([])
  })
})

describe('listQaTemplates', () => {
  it('always names the purpose — the endpoint defaults to manual', async () => {
    await listQaTemplates({ purpose: 'ai', include_archived: true })
    expect(sentQuery()).toBe('include_archived=true&purpose=ai')
  })
})
