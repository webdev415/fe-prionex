import { describe, it, expect } from 'vitest'

import { detectDelimiter } from '../bulkWriteoffCsv'

const CANONICAL = 'loan_id,cancellation_date,principal,interest,fine,penalty,commission'

describe('detectDelimiter', () => {
  it('detects a comma-delimited header', () => {
    expect(detectDelimiter(CANONICAL)).toBe(',')
  })

  it('detects a semicolon-delimited header (Excel European/Cyrillic export)', () => {
    expect(
      detectDelimiter('loan_id;cancellation_date;principal;interest;fine;penalty;commission')
    ).toBe(';')
  })

  it('detects a tab-delimited header', () => {
    expect(
      detectDelimiter('loan_id\tcancellation_date\tprincipal\tinterest\tfine\tpenalty\tcommission')
    ).toBe('\t')
  })

  it('defaults to comma when no delimiter is present', () => {
    expect(detectDelimiter('loan_id')).toBe(',')
    expect(detectDelimiter('')).toBe(',')
  })

  it('prefers comma on a tie so existing comma files are unaffected', () => {
    // Equal counts of ',' and ';' -> first candidate (',') wins.
    expect(detectDelimiter('a,b;c')).toBe(',')
  })
})
