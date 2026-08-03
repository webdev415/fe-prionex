import { describe, expect, it } from 'vitest'
import {
  contactTypesForSection,
  pickDefaultActiveContactTypeIdForSection,
} from './contactTypeLabel'

const types = [
  {
    id: 7,
    name: 'Third party mobile',
    code: 'third_party_mobile_phone',
    is_hidden: false,
    sort_order: 30,
    is_phone: true,
  },
  {
    id: 3,
    name: 'Personal email',
    code: 'email_personal',
    is_hidden: false,
    sort_order: 10,
    is_phone: false,
  },
  {
    id: 29,
    name: 'Register mobile',
    code: 'register_mobile_phone',
    is_hidden: false,
    sort_order: 5,
    is_phone: true,
  },
  {
    id: 4,
    name: 'Actual address',
    code: 'actual_address',
    is_hidden: false,
    sort_order: 20,
    is_phone: false,
  },
  { id: 1, name: 'Hidden phone', code: 'mobile', is_hidden: true, sort_order: 1, is_phone: true },
]

describe('contactTypesForSection', () => {
  it('returns phone types sorted independently of others', () => {
    const phones = contactTypesForSection(types, true)
    expect(phones.map((t) => t.id)).toEqual([29, 7])
  })

  it('returns non-phone types sorted independently', () => {
    const others = contactTypesForSection(types, false)
    expect(others.map((t) => t.id)).toEqual([3, 4])
  })

  it('includes a hidden type when it is the current selection', () => {
    const phones = contactTypesForSection(types, true, 1)
    expect(phones.map((t) => t.id)).toEqual([1, 29, 7])
  })
})

describe('pickDefaultActiveContactTypeIdForSection', () => {
  it('picks the first active type in the section', () => {
    expect(pickDefaultActiveContactTypeIdForSection(types, true)).toBe(29)
    expect(pickDefaultActiveContactTypeIdForSection(types, false)).toBe(3)
  })
})
