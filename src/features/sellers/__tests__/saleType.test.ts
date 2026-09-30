import { describe, expect, it } from 'vitest'

import {
  CESSION_FROM,
  DEFAULT_SALE_TYPE,
  SALE_TYPES,
  saleTypeByPurchaseDate,
  saleTypeLabelKey,
  toSaleType,
} from '../saleType'

describe('sale type', () => {
  it('knows exactly the two values the server accepts', () => {
    expect(SALE_TYPES).toEqual(['factoring', 'cession'])
  })

  it('preselects cession for a new sale', () => {
    expect(DEFAULT_SALE_TYPE).toBe('cession')
  })

  it.each(SALE_TYPES)('reads %s as itself and labels it from the values dictionary', (value) => {
    expect(toSaleType(value)).toBe(value)
    expect(saleTypeLabelKey(value)).toBe(`saleType.values.${value}`)
  })

  // A server not rolled out yet omits the field; the rest is data we cannot
  // name. None of it may turn into a guessed label.
  it.each([
    ['a missing field', undefined],
    ['null', null],
    ['an empty string', ''],
    ['another casing', 'Factoring'],
    ['a third type', 'credit'],
    ['a prototype name', 'constructor'],
    ['a number', 1],
    ['an object', { value: 'cession' }],
  ])('treats %s as no type', (_label, value) => {
    expect(toSaleType(value)).toBeNull()
    expect(saleTypeLabelKey(value)).toBeNull()
  })
})

describe('sale type by purchase date', () => {
  it('draws the boundary on 30.07.2026, as client-service does', () => {
    expect(CESSION_FROM).toBe('2026-07-30')
  })

  it.each([
    ['2026-07-29', 'factoring'],
    ['2026-07-30', 'cession'],
    ['2026-09-30', 'cession'],
    ['2019-01-01', 'factoring'],
    // What the wizard stores: the chosen day as a noon-UTC datetime.
    ['2026-07-29T12:00:00.000Z', 'factoring'],
    ['2026-07-30T12:00:00.000Z', 'cession'],
  ])('%s → %s', (date, expected) => {
    expect(saleTypeByPurchaseDate(date)).toBe(expected)
  })

  // Built the way the wizard builds it from the picked day, not typed in by hand.
  it.each([
    ['29.07.2026', 'factoring', Date.UTC(2026, 6, 29, 12)],
    ['30.07.2026', 'cession', Date.UTC(2026, 6, 30, 12)],
  ])('reads %s picked in the wizard (noon UTC, ISO) → %s', (_day, expected, utcMs) => {
    expect(saleTypeByPurchaseDate(new Date(utcMs).toISOString())).toBe(expected)
  })

  it('names no type for an empty date', () => {
    expect(saleTypeByPurchaseDate('')).toBeNull()
  })
})
