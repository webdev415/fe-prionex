import { describe, expect, it } from 'vitest'
import {
  CONTACT_TAG_TAB_IDS,
  DEFAULT_CONTACT_TAG_TAB,
  isContactTagTab,
  resolveContactTagTab,
  tagTabRequestParam,
} from '../tagTabs'

describe('contact-tag sub-tabs', () => {
  it('offers the aggregate first and defaults to it', () => {
    expect(CONTACT_TAG_TAB_IDS).toEqual(['all', 'kontakt', 'nekontakt'])
    expect(DEFAULT_CONTACT_TAG_TAB).toBe('all')
    expect(CONTACT_TAG_TAB_IDS[0]).toBe(DEFAULT_CONTACT_TAG_TAB)
  })

  it('spells the two tag ids exactly as the backend spells the CODES', () => {
    // The ids travel in `?kg=` AND go on the wire as `tag_code`, so a
    // display-flavoured id ("contact") would earn a 400 from an endpoint that
    // only knows `kontakt`/`nekontakt` (CONTACT_TAG_FEED_TAG_CODES), while
    // still rendering a plausible-looking strip.
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

    it('never lets an unknown value reach the wire as a tag_code', () => {
      // The resolve step is what stands between a hand-edited `?kg=` and the
      // endpoint's 400 for an unconfigured code: whatever the URL says, the
      // request either carries one of the two known codes or no key at all.
      for (const raw of ['kontakty', 'Контакт', 'd17', '']) {
        const param = tagTabRequestParam(resolveContactTagTab(raw))
        expect(param).toStrictEqual({})
      }
    })
  })

  it('narrows isContactTagTab to the three known ids', () => {
    expect(isContactTagTab('kontakt')).toBe(true)
    expect(isContactTagTab('Неконтакт')).toBe(false)
  })

  describe('tagTabRequestParam', () => {
    it('sends the tab id verbatim as the tag_code of a tag tab', () => {
      // The URL value and the wire value are deliberately the same string.
      expect(tagTabRequestParam('kontakt')).toStrictEqual({ tag_code: 'kontakt' })
      expect(tagTabRequestParam('nekontakt')).toStrictEqual({ tag_code: 'nekontakt' })
    })

    it('omits the KEY entirely for «Всі», rather than sending an undefined one', () => {
      // «Всі» is the absence of the filter, not a code the backend knows. The
      // omission has to be a real one: axios would drop an `undefined` value
      // just the same, but the params object is also the query key, where
      // `{ tag_code: undefined }` and `{}` must not be two spellings of one
      // cache entry. `toStrictEqual` is what tells them apart.
      expect(tagTabRequestParam('all')).toStrictEqual({})
      expect('tag_code' in tagTabRequestParam('all')).toBe(false)
    })

    it('gives every tab its own request shape, so no two share a query key', () => {
      const shapes = CONTACT_TAG_TAB_IDS.map((id) => JSON.stringify(tagTabRequestParam(id)))

      expect(new Set(shapes).size).toBe(CONTACT_TAG_TAB_IDS.length)
    })
  })
})
