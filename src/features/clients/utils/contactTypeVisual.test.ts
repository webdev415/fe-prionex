import { describe, expect, it } from 'vitest'
import { contactTypePillToneClass, sortContactsByTypeOrder } from './contactTypeVisualHelpers'

describe('sortContactsByTypeOrder', () => {
  const types = new Map([
    [29, { sort_order: 5, name: 'Register' }],
    [7, { sort_order: 30, name: 'Third party' }],
    [3, { sort_order: 10, name: 'Email' }],
  ])

  it('sorts contacts by type sort_order within a section', () => {
    const contacts = [
      { id: 2, contactTypeId: 7 },
      { id: 1, contactTypeId: 29 },
      { id: 3, contactTypeId: 7 },
    ]
    expect(sortContactsByTypeOrder(contacts, types).map((c) => c.id)).toEqual([1, 2, 3])
  })

  it('puts unknown types after ranked ones', () => {
    const contacts = [
      { id: 9, contactTypeId: null },
      { id: 1, contactTypeId: 29 },
    ]
    expect(sortContactsByTypeOrder(contacts, types).map((c) => c.id)).toEqual([1, 9])
  })
})

describe('contactTypePillToneClass', () => {
  it('maps mockup categories to distinct tones', () => {
    expect(contactTypePillToneClass('verified_third_party', true)).toContain('text-[#2f7dd1]')
    expect(contactTypePillToneClass('third_party_mobile_phone', true)).toContain('text-[#b06a1d]')
    expect(contactTypePillToneClass('register_mobile_phone', true)).toContain('text-[#6b7077]')
    expect(contactTypePillToneClass('email_personal', false)).toContain('text-[#2f7dd1]')
    expect(contactTypePillToneClass('mobile_phone', true)).toContain('text-[#519a3d]')
  })
})
