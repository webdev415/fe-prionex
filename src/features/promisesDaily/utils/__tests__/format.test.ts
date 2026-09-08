import { describe, expect, it } from 'vitest'
import { EMPTY, formatMoney } from '../format'

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

  it('renders a plain number (the client-side day totals) by the same rule', () => {
    expect(formatMoney(1250, 'en')).toBe('1,250.00')
    expect(formatMoney(0, 'en')).toBe('0.00')
  })

  it('renders "—" for a missing or unparseable amount instead of "NaN"', () => {
    expect(formatMoney(null, 'en')).toBe(EMPTY)
    expect(formatMoney(undefined, 'en')).toBe(EMPTY)
    expect(formatMoney('not-a-number', 'en')).toBe(EMPTY)
    expect(formatMoney(NaN, 'en')).toBe(EMPTY)
  })
})
