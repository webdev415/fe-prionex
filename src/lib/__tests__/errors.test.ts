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

  it('accepts a validation array with at least one usable item', () => {
    expect(
      hasResponseDetail(makeHttpError(422, { detail: [{ msg: 'value is not a valid date' }] }))
    ).toBe(true)
    expect(hasResponseDetail(makeHttpError(422, { detail: ['plain string item'] }))).toBe(true)
    // One usable item among garbage is still something to say — and it is
    // exactly what getErrorMessage renders: the unusable items are dropped, not
    // stringified alongside it (see the getErrorMessage suite below).
    expect(hasResponseDetail(makeHttpError(422, { detail: [{}, { msg: 'too long' }] }))).toBe(true)
  })

  it('rejects a non-empty array with no usable item', () => {
    // The deliberate FLIP of the old byte-for-byte pin (`detail: [{}]` used to
    // count on array length alone): there is nothing in these items a reader
    // could use, and getErrorMessage now drops them rather than stringifying
    // them — so an array of nothing but garbage is an EMPTY array to both, and
    // both answer accordingly.
    const error = makeHttpError(422, { detail: [{}] })
    expect(getErrorMessage(error)).toBe('Validation error occurred')
    expect(hasResponseDetail(error)).toBe(false)

    // The same rule item by item: blank strings, blank msg, msg of a wrong
    // type, null items — none of them reads as a message.
    expect(hasResponseDetail(makeHttpError(422, { detail: [''] }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(422, { detail: ['   '] }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(422, { detail: [{ msg: '   ' }] }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(422, { detail: [{ msg: 42 }] }))).toBe(false)
    expect(hasResponseDetail(makeHttpError(422, { detail: [null] }))).toBe(false)
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

  it('reads an EMPTY detail string as "no detail" even when `message` holds a usable one', () => {
    // The documented asymmetry (see the docblock), pinned so it stays a known
    // shape rather than a surprise: the predicate stops at `detail` once the
    // key is there, while getErrorMessage falls THROUGH a falsy `detail` to
    // `message`. A caller gated on the predicate therefore shows its own
    // localized text and never quotes this sentence. Left as is on purpose —
    // no backend of ours sends this body, and widening the check would mean a
    // second definition of "has a detail" to keep in step with getErrorMessage.
    const error = makeHttpError(400, { detail: '', message: 'Sell window too wide' })

    expect(getErrorMessage(error)).toBe('Sell window too wide')
    expect(hasResponseDetail(error)).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('joins the usable items of a validation array and drops the rest', () => {
    // FastAPI writes `{type, loc, msg, input, ctx}` per item, but a proxy or a
    // hand-rolled handler can put anything in that array. Only the two shapes
    // a reader can use survive; the rest are dropped rather than stringified,
    // so an operator never reads "{}" glued to a real sentence.
    expect(getErrorMessage(makeHttpError(422, { detail: [{ msg: 'x' }, {}] }))).toBe('x')
    expect(getErrorMessage(makeHttpError(422, { detail: [{ msg: 'x' }, {}] }))).not.toContain('{}')

    expect(getErrorMessage(makeHttpError(422, { detail: ['first', { msg: 'second' }] }))).toBe(
      'first. second'
    )
    // Numbers, nulls and blanks are not sentences either.
    expect(getErrorMessage(makeHttpError(422, { detail: [42, null, '  ', { msg: 'only' }] }))).toBe(
      'only'
    )
  })

  it('answers with its own fallback when the array holds nothing usable', () => {
    // Untranslated and hardcoded — which is exactly why callers gate on
    // hasResponseDetail (false for this body) and show their own copy instead.
    expect(getErrorMessage(makeHttpError(422, { detail: [{}, null, 42] }))).toBe(
      'Validation error occurred'
    )
  })
})
