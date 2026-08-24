import { describe, expect, it } from 'vitest'
import { EMPTY, formatConversion, formatCount, formatMoney } from '../format'

// `formatNumber` (@/lib/localeFormat) is real here, so these exercise the
// actual Intl path in both UI languages, not a stub.

describe('formatMoney', () => {
  it('renders a Decimal-as-string amount with locale grouping and two decimals', () => {
    expect(formatMoney('112062.00', 'en')).toBe('112,062.00')
    // uk-UA groups with a NO-BREAK space and uses a decimal comma. Which
    // exact invisible space ICU picks (U+00A0 or U+202F) has changed between
    // Node releases, so the separator is normalised rather than pinned — what
    // this asserts is the grouping and the comma, not the CLDR of the day.
    expect(formatMoney('112062.00', 'uk').replace(/\s/g, ' ')).toBe('112 062,00')
  })

  it('rounds an over-precise promised amount to the hryvnia hundredth', () => {
    // Production really does carry "34508717.5067" in sum_from.
    expect(formatMoney('34508717.5067', 'en')).toBe('34,508,717.51')
  })

  it('keeps a negative unpaid value negative rather than hiding it', () => {
    // `unpaid` = sum_to − paid_full, so a negative number means the operator
    // collected MORE than was due — common, because payments are never matched
    // to the promises they settle.
    expect(formatMoney('-7400.00', 'en')).toBe('-7,400.00')
  })

  it('renders "—" for a missing or unparseable amount instead of "NaN"', () => {
    expect(formatMoney(null, 'en')).toBe(EMPTY)
    expect(formatMoney(undefined, 'en')).toBe(EMPTY)
    expect(formatMoney('not-a-number', 'en')).toBe(EMPTY)
  })
})

describe('formatCount', () => {
  it('renders a count with locale grouping and no decimals', () => {
    expect(formatCount(208137, 'en')).toBe('208,137')
    expect(formatCount(0, 'en')).toBe('0')
  })

  it('renders "—" for a missing count instead of "NaN"', () => {
    expect(formatCount(null, 'en')).toBe(EMPTY)
  })
})

describe('formatConversion', () => {
  it('multiplies the backend SHARE by 100 and appends a percent sign', () => {
    // The contract returns a share rounded to six decimals and states that the
    // frontend multiplies by 100.
    expect(formatConversion('1.308333', 'en')).toBe('130.83%')
    expect(formatConversion('0.749039', 'en')).toBe('74.90%')
  })

  it('does not clamp a conversion above 100 %', () => {
    // Legitimate: conversion is "money collected ÷ money due", not "share of
    // promises kept" — the July 2026 production maximum is 8.15 (815 %).
    expect(formatConversion('8.15', 'en')).toBe('815.00%')
  })

  it('renders "—" for a null conversion rather than "0,00 %"', () => {
    // null means sum_to = 0: nothing was DUE. Showing 0 % would read as "this
    // operator collected nothing" for someone who may have collected plenty.
    expect(formatConversion(null, 'en')).toBe(EMPTY)
    expect(formatConversion(undefined, 'en')).toBe(EMPTY)
  })

  it('renders "—" for an unparseable conversion instead of "NaN%"', () => {
    expect(formatConversion('not-a-number', 'en')).toBe(EMPTY)
  })

  it('renders 0 % when money was due and nothing arrived', () => {
    // The one case that IS a zero rather than an "undefined".
    expect(formatConversion('0', 'en')).toBe('0.00%')
  })

  it('formats in the UI language, not the host locale', () => {
    expect(formatConversion('1.308333', 'uk')).toBe('130,83%')
  })
})
