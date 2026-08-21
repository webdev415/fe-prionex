import { describe, expect, it } from 'vitest'
import { getErrorMessage, hasResponseDetail } from '../errors'

/**
 * `hasResponseDetail` is the gate every report tab puts in front of
 * `getErrorMessage` before quoting a server sentence to an operator, so the
 * cases below are paired with what `getErrorMessage` actually returns for the
 * same body: the predicate exists precisely because that function never says
 * "nothing to say".
 */

/** Error shaped like an AxiosError, as the axios type guard reads it. */
function makeHttpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

describe('hasResponseDetail', () => {
  it('is false for anything that is not an axios error', () => {
    // A thrown Error, a string, null — none of them have a response body.
    expect(hasResponseDetail(new Error('boom'))).toBe(false)
    expect(hasResponseDetail('boom')).toBe(false)
    expect(hasResponseDetail(null)).toBe(false)
    expect(hasResponseDetail(undefined)).toBe(false)
  })

  it('is false when the response never arrived (a dropped connection, a 502)', () => {
    expect(
      hasResponseDetail(Object.assign(new Error('ECONNABORTED'), { isAxiosError: true }))
    ).toBe(false)
  })

  it('is false for a body-less response', () => {
    expect(hasResponseDetail(makeHttpError(400))).toBe(false)
    expect(hasResponseDetail(makeHttpError(503))).toBe(false)
  })

  it('is false for a body with no readable field', () => {
    expect(hasResponseDetail(makeHttpError(400, {}))).toBe(false)
    // A non-object, non-string body carries nothing to quote either.
    expect(hasResponseDetail(makeHttpError(400, 42))).toBe(false)
  })

  it('accepts a bare string body, but not a blank one', () => {
    expect(hasResponseDetail(makeHttpError(400, 'Unknown IANA timezone: Mars/Olympus'))).toBe(true)
    expect(hasResponseDetail(makeHttpError(400, ''))).toBe(false)
    expect(hasResponseDetail(makeHttpError(400, '   '))).toBe(false)
  })

  it('accepts a FastAPI `detail` string, but not a blank one', () => {
    expect(
      hasResponseDetail(makeHttpError(400, { detail: 'Request a narrower sell window' }))
    ).toBe(true)
    expect(hasResponseDetail(makeHttpError(400, { detail: '' }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(400, { detail: '   ' }))).toBe(false)
  })

  it('treats an EMPTY validation array as no detail — the hardcoded English is not a message', () => {
    const error = makeHttpError(422, { detail: [] })

    // This is the whole reason the empty array is excluded: getErrorMessage
    // answers with its own untranslated fallback, which is no more fit to show
    // an operator than the axios text the predicate exists to suppress.
    expect(getErrorMessage(error)).toBe('Validation error occurred')
    expect(hasResponseDetail(error)).toBe(false)
  })

  it('accepts a non-empty validation array', () => {
    expect(
      hasResponseDetail(makeHttpError(422, { detail: [{ msg: 'value is not a valid date' }] }))
    ).toBe(true)
    expect(hasResponseDetail(makeHttpError(422, { detail: ['plain string item'] }))).toBe(true)
  })

  it('takes a non-empty array at its word, even when the items are unusable', () => {
    // Pinning today's behaviour, not endorsing it: `getErrorMessage` stringifies
    // such an item into raw JSON. Tightening the non-empty-array branch is a
    // deferred follow-up — the predicate was moved here byte-for-byte on
    // purpose.
    const error = makeHttpError(422, { detail: [{}] })

    expect(hasResponseDetail(error)).toBe(true)
    expect(getErrorMessage(error)).toBe('{}')
  })

  it('falls back to a `message` field when there is no detail', () => {
    expect(hasResponseDetail(makeHttpError(500, { message: 'Internal failure' }))).toBe(true)
    expect(hasResponseDetail(makeHttpError(500, { message: '   ' }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(500, { message: 7 }))).toBe(false)
  })

  it('does not consult `message` once a `detail` decided the answer', () => {
    // A blank detail is an answer ("no detail"), not a miss. Note what
    // `getErrorMessage` does with this body: '  ' is truthy, so it returns the
    // blank itself and never reaches `message`. The predicate trims and answers
    // false rather than deferring to a `message` the endpoint's own contract
    // never promised.
    expect(hasResponseDetail(makeHttpError(400, { detail: '  ', message: 'from the proxy' }))).toBe(
      false
    )
  })
})
