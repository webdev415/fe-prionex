/**
 * Module-level coverage for the contact-tag feed API wrapper. Every feature
 * test mocks `getContactTagFeed` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed on
 * the way to axios would otherwise ship green.
 *
 * The load-bearing case is the EMPTY `sell_to`: the backend can only tell
 * "absent" from "empty" because both bounds arrive as raw strings, so a wrapper
 * that normalised `''` away (or a caller that passed `undefined`) would switch
 * the operator's "no upper bound" back into a four-month default without a
 * single visible symptom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactTagFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getContactTagFeed } from '../contactTagFeedApi'

describe('getContactTagFeed', () => {
  const response: ContactTagFeedResponse = {
    project_id: 1,
    view_date: '2026-08-26',
    sell_from: null,
    sell_to: '2026-04-30',
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-08-26T08:31:02.114Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the contact-tag feed endpoint with the full params verbatim', async () => {
    await getContactTagFeed({
      project_id: 1,
      view_date: '2026-08-26',
      sell_from: '2026-01-01',
      sell_to: '2026-06-30',
      skip: 50,
      limit: 50,
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/contact-tag', {
      params: {
        project_id: 1,
        view_date: '2026-08-26',
        sell_from: '2026-01-01',
        sell_to: '2026-06-30',
        skip: 50,
        limit: 50,
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('forwards an EMPTY sell_to as an empty string, not as an absent key', async () => {
    // `sell_to=` is the wire signal for "switch the upper bound off". Axios keeps
    // empty strings and drops null/undefined, so this string must survive
    // untouched — normalising it away would re-apply the month−4 default.
    await getContactTagFeed({ project_id: 1, view_date: '2026-08-26', sell_to: '' })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({
      project_id: 1,
      view_date: '2026-08-26',
      sell_to: '',
    })
    expect(config.params.sell_to).toBe('')
  })

  it('passes an ABSENT sell_to through as a genuinely absent KEY', async () => {
    // The third state: no parameter at all, so the backend applies its default.
    // `toStrictEqual` because `{ sell_to: undefined }` would pass a loose
    // toEqual while being a different object — and the caller builds the
    // omission by spreading, which this module must not undo.
    await getContactTagFeed({ project_id: 1, view_date: '2026-08-26' })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1, view_date: '2026-08-26' })
    expect('sell_to' in config.params).toBe(false)
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getContactTagFeed({ project_id: 1, view_date: '2026-08-26' })).resolves.toBe(
      response
    )
  })

  it('parses a contract-shaped row without reshaping any field', async () => {
    // The wire contract (services/client/app/schemas/contact_tag_feed.py):
    // date-only strings, `body_amount` as a Decimal-as-STRING, `tag_code`
    // alongside `tag_name`, `last_planed_interaction_date` nullable.
    const wire: ContactTagFeedResponse = {
      project_id: 1,
      view_date: '2026-08-26',
      sell_from: null,
      sell_to: '2026-04-30',
      rows: [
        {
          client_id: 421395,
          inn: '3210987654',
          tag_code: 'nekontakt',
          tag_name: 'Неконтакт',
          sell_date: '2026-03-11',
          assignment_date: '2026-06-02',
          last_planed_interaction_date: null,
          employee_id: 6971,
          employee_name: 'Коваленко Іван Петрович',
          body_amount: '15000.00',
          last_interaction_date: '2026-08-14',
          department: 'Стягнення',
          group_name: 'Група №3',
        },
      ],
      total: 44113,
      page: 1,
      page_size: 50,
      total_pages: 883,
      generated_at: '2026-08-26T08:31:02.114Z',
    }
    mockApi.get.mockResolvedValue({ data: wire })

    const result = await getContactTagFeed({ project_id: 1, view_date: '2026-08-26' })

    expect(result).toStrictEqual(wire)
    // Money stays an exact STRING on the way in — coercing it to a number here
    // would be the one place a Decimal could lose a cent.
    expect(result.rows[0].body_amount).toBe('15000.00')
    // The stable key and the display label are two different fields, and the
    // API must not fold one into the other.
    expect(result.rows[0].tag_code).toBe('nekontakt')
    expect(result.rows[0].tag_name).toBe('Неконтакт')
    // The APPLIED window is echoed even though the request carried no sell_to.
    expect(result.sell_to).toBe('2026-04-30')
  })

  it('parses the switched-off window echo (sell_to: null) without reshaping it', async () => {
    mockApi.get.mockResolvedValue({ data: { ...response, sell_to: null } })

    const result = await getContactTagFeed({
      project_id: 1,
      view_date: '2026-08-26',
      sell_to: '',
    })

    expect(result.sell_to).toBeNull()
  })
})
