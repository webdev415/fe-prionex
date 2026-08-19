import { describe, it, expect } from 'vitest'
import { buildContactPayload } from '../contactPayload'

const form = (overrides: Partial<Parameters<typeof buildContactPayload>[0]> = {}) => ({
  contact_value: '380501234567',
  contact_type_id: 3,
  comment: 'lives with mother',
  ...overrides,
})

describe('buildContactPayload', () => {
  describe('comment', () => {
    it('sends null — NOT undefined — when the field is cleared', () => {
      // The whole bug in one assertion. axios drops undefined keys, and the
      // update endpoint reads a missing field as "leave the stored value
      // alone", so `undefined` here silently kept the old comment.
      const payload = buildContactPayload(form({ comment: '' }))

      expect(payload.comment).toBeNull()
      expect(payload.comment).not.toBeUndefined()
      // Serialisation is what actually loses it, so assert on that too.
      expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('comment', null)
    })

    it('sends null for a whitespace-only comment', () => {
      const payload = buildContactPayload(form({ comment: '   ' }))
      expect(payload.comment).toBeNull()
    })

    it('keeps text, trimmed', () => {
      const payload = buildContactPayload(form({ comment: '  knows the debtor  ' }))
      expect(payload.comment).toBe('knows the debtor')
    })

    it('null rather than empty string, so cleared and never-set match', () => {
      // The column would otherwise hold two spellings of "no comment"
      // depending on which path wrote it: NULL from create, '' from an edit.
      const payload = buildContactPayload(form({ comment: '' }))
      expect(payload.comment).not.toBe('')
    })
  })

  describe('the other fields', () => {
    it('trims the contact value', () => {
      const payload = buildContactPayload(form({ contact_value: '  380501234567 ' }))
      expect(payload.contact_value).toBe('380501234567')
    })

    it('passes the type through, including null', () => {
      expect(buildContactPayload(form({ contact_type_id: 7 })).contact_type_id).toBe(7)
      expect(buildContactPayload(form({ contact_type_id: null })).contact_type_id).toBeNull()
    })
  })

  it('produces the same shape for create and update', () => {
    // One builder feeds both, so a divergence here would be a bug in whichever
    // path was not being looked at.
    const payload = buildContactPayload(form({ comment: '' }))
    expect(Object.keys(payload).sort()).toEqual(['comment', 'contact_type_id', 'contact_value'])
  })
})
