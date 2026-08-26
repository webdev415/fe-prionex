import { describe, expect, it } from 'vitest'
import type { ContactTagFeedRow } from '../../api/types'
import {
  CONTACT_TAG_TAB_IDS,
  DEFAULT_CONTACT_TAG_TAB,
  countRowsByTagTab,
  filterRowsByTagTab,
  isContactTagTab,
  resolveContactTagTab,
} from '../tagTabs'

function makeRow(overrides: Partial<ContactTagFeedRow> = {}): ContactTagFeedRow {
  return {
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
    ...overrides,
  }
}

describe('contact-tag sub-tabs', () => {
  it('offers the aggregate first and defaults to it', () => {
    expect(CONTACT_TAG_TAB_IDS).toEqual(['all', 'kontakt', 'nekontakt'])
    expect(DEFAULT_CONTACT_TAG_TAB).toBe('all')
    expect(CONTACT_TAG_TAB_IDS[0]).toBe(DEFAULT_CONTACT_TAG_TAB)
  })

  it('spells the two tag ids exactly as the backend spells the CODES', () => {
    // The ids travel in `?kg=` AND are compared against `row.tag_code`, so a
    // display-flavoured id ("contact") would filter nothing while still
    // rendering a plausible-looking strip. The backend's configured codes are
    // `kontakt` / `nekontakt` (CONTACT_TAG_FEED_TAG_CODES).
    expect(CONTACT_TAG_TAB_IDS).toContain('kontakt')
    expect(CONTACT_TAG_TAB_IDS).toContain('nekontakt')
  })

  describe('resolveContactTagTab', () => {
    it.each([
      ['an absent key', null],
      ['an empty value', ''],
      ['an unknown value', 'kontakty'],
      ['a LOCALIZED name instead of the code', 'Контакт'],
      ['a department id from the sibling report', 'd17'],
    ])('falls back to «Всі» for %s', (_case, raw) => {
      expect(resolveContactTagTab(raw)).toBe('all')
    })

    it.each(CONTACT_TAG_TAB_IDS)('accepts the known id %s', (id) => {
      expect(resolveContactTagTab(id)).toBe(id)
    })
  })

  it('narrows isContactTagTab to the three known ids', () => {
    expect(isContactTagTab('kontakt')).toBe(true)
    expect(isContactTagTab('Неконтакт')).toBe(false)
  })

  describe('filterRowsByTagTab', () => {
    const rows = [
      makeRow({ client_id: 1, tag_code: 'kontakt', tag_name: 'Контакт' }),
      makeRow({ client_id: 2, tag_code: 'nekontakt' }),
      makeRow({ client_id: 3, tag_code: 'kontakt', tag_name: 'Контакт' }),
    ]

    it('returns the SAME array reference for «Всі» so a memo over it does not churn', () => {
      expect(filterRowsByTagTab(rows, 'all')).toBe(rows)
    })

    it('keeps only the exact code matches on a tag tab', () => {
      expect(filterRowsByTagTab(rows, 'kontakt').map((row) => row.client_id)).toEqual([1, 3])
      expect(filterRowsByTagTab(rows, 'nekontakt').map((row) => row.client_id)).toEqual([2])
    })

    it('filters by the CODE, never by the localized name', () => {
      // A directory rename (or a locale switch) must not empty a tab. Here the
      // display label is nonsense and the code is right: the row still lands on
      // its tab, which is the whole reason the strip is keyed on the code.
      const renamed = [makeRow({ client_id: 9, tag_code: 'kontakt', tag_name: 'Контактний' })]

      expect(filterRowsByTagTab(renamed, 'kontakt')).toHaveLength(1)
      expect(filterRowsByTagTab(renamed, 'nekontakt')).toHaveLength(0)
    })

    it('leaves a row whose code is outside the configured pair on «Всі» only', () => {
      // Only reachable if CONTACT_TAG_FEED_TAG_CODES is reconfigured. Nothing
      // is hidden — «Всі» is the default tab and the table names the tag on
      // every row — but no tag tab claims it.
      const mixed = [...rows, makeRow({ client_id: 4, tag_code: 'vip', tag_name: 'VIP' })]

      expect(filterRowsByTagTab(mixed, 'all')).toHaveLength(4)
      expect(filterRowsByTagTab(mixed, 'kontakt')).toHaveLength(2)
      expect(filterRowsByTagTab(mixed, 'nekontakt')).toHaveLength(1)
    })

    it('preserves the server-side order inside a tab', () => {
      // Rows arrive sorted by employee, then last_interaction_date DESC, then
      // client_id; a client-side filter must not reorder what it keeps.
      const ordered = [
        makeRow({ client_id: 10, tag_code: 'kontakt', last_interaction_date: '2026-08-20' }),
        makeRow({ client_id: 11, tag_code: 'nekontakt' }),
        makeRow({ client_id: 12, tag_code: 'kontakt', last_interaction_date: '2026-08-02' }),
      ]

      expect(filterRowsByTagTab(ordered, 'kontakt').map((row) => row.client_id)).toEqual([10, 12])
    })
  })

  describe('countRowsByTagTab', () => {
    it('counts every tab, «Всі» being the whole page', () => {
      const rows = [
        makeRow({ client_id: 1, tag_code: 'kontakt' }),
        makeRow({ client_id: 2, tag_code: 'kontakt' }),
        makeRow({ client_id: 3, tag_code: 'nekontakt' }),
      ]

      expect(countRowsByTagTab(rows)).toEqual({ all: 3, kontakt: 2, nekontakt: 1 })
    })

    it('is zero everywhere for an empty page', () => {
      expect(countRowsByTagTab([])).toEqual({ all: 0, kontakt: 0, nekontakt: 0 })
    })

    it('counts an unknown code into «Всі» only, so the two halves visibly disagree', () => {
      // The reader can then see that some row belongs to neither tag, instead
      // of a strip whose numbers happen to add up while a row is nowhere.
      const rows = [makeRow({ tag_code: 'vip' }), makeRow({ tag_code: 'kontakt' })]

      expect(countRowsByTagTab(rows)).toEqual({ all: 2, kontakt: 1, nekontakt: 0 })
    })

    it('agrees with filterRowsByTagTab on every tab', () => {
      // The two are derived from the same equality on purpose — a strip whose
      // count disagreed with its own table is the failure this pins.
      const rows = [
        makeRow({ client_id: 1, tag_code: 'kontakt' }),
        makeRow({ client_id: 2, tag_code: 'nekontakt' }),
        makeRow({ client_id: 3, tag_code: 'nekontakt' }),
        makeRow({ client_id: 4, tag_code: 'vip' }),
      ]
      const counts = countRowsByTagTab(rows)

      for (const id of CONTACT_TAG_TAB_IDS) {
        expect(filterRowsByTagTab(rows, id)).toHaveLength(counts[id])
      }
    })
  })
})
