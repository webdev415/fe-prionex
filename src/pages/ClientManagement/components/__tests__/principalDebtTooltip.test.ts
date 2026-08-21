import { describe, expect, it } from 'vitest'

import { buildPrincipalDebtTooltip, groupThousands } from '../principalDebtTooltip'

// The global `t` mock returns the key; here we supply our own so assertions
// read against real wording rather than key names.
const t = (_key: string, fallback: string) => fallback

const NBSP = '\u00A0'
const ENDASH = '\u2013'
const TIMES = '\u00D7'

const COEFFICIENT = {
  min_coefficient: '1.5',
  max_coefficient: '2.0',
  min_amount: '5051',
  max_amount: '6735',
  debt_age_days: 41,
}

describe('groupThousands', () => {
  it.each([
    ['5051', `5${NBSP}051`],
    ['6735', `6${NBSP}735`],
    ['999', '999'],
    ['1234567', `1${NBSP}234${NBSP}567`],
  ])('formats %s with non-breaking separators', (input, expected) => {
    expect(groupThousands(input)).toBe(expected)
  })

  it('uses a non-breaking space so amounts cannot wrap mid-value', () => {
    expect(groupThousands('5051')).not.toContain(' ')
  })
})

describe('buildPrincipalDebtTooltip', () => {
  it('is the coefficient line and nothing else', () => {
    // KAN-994 "Tooltip format - Single line".
    const out = buildPrincipalDebtTooltip(COEFFICIENT, t)
    expect(out).toBe(
      `Loan closing coefficient: ${TIMES}1.5${ENDASH}2.0: ` +
        `\u20B4${NBSP}5${NBSP}051 ${ENDASH} 6${NBSP}735`
    )
  })

  it('returns null when no coefficient applies, so no tooltip is shown', () => {
    // AC: hovering Principal debt when it is "-" or the age matches no
    // configured range shows no tooltip. The backend returns null for each of
    // those cases plus a missing purchase date.
    for (const empty of [null, undefined]) {
      expect(buildPrincipalDebtTooltip(empty, t)).toBeNull()
    }
  })
})
