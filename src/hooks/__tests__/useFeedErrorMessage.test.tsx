import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEED_ERROR_KEY_PREFIXES, useFeedErrorMessage } from '../useFeedErrorMessage'

/**
 * The ladder, pinned as a TABLE over the cross-product of failures rather than
 * as one case per branch.
 *
 * The branches read as ordered (transient, then 403, then a detailed 400) but
 * are in fact disjoint — `isTransientFailure` answers 502/503/504 or a
 * response-less network code, and a status exists only where a response does.
 * That disjointness is a fact about `TRANSIENT_RETRY_STATUSES` in `lib/api.ts`,
 * somebody else's set: the day 429 (or 500) joins it, the rows below start
 * disagreeing with the hook and say so. The 500 row is there for exactly that
 * reason — it is NOT transient today, and a predicate "simplified" to
 * `status >= 500` would silently change what all twelve tabs show.
 *
 * The translator is stubbed to return the key, so a row asserts which KEY the
 * hook asked for; that the key exists in both dictionaries is the separate
 * concern of `feedErrorKeys.test.ts`.
 */

/** Swapped by the language-switch case; the default stands in for i18n. */
let translate: (key: string) => string = (key) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => translate(key) }),
}))

afterEach(() => {
  translate = (key) => key
})

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

function networkError(code: string) {
  return Object.assign(new Error(code), { isAxiosError: true, code })
}

const TAB = 'promisesFeed' as const
const PREFIX = FEED_ERROR_KEY_PREFIXES[TAB]
const DETAIL = { detail: 'Date range must not exceed 366 days' }

const render = (error: unknown) => renderHook(() => useFeedErrorMessage(error, TAB)).result

describe('useFeedErrorMessage', () => {
  it.each([
    ['403', httpError(403), `${PREFIX}.forbidden`, null],
    ['403 that happens to carry a detail', httpError(403, DETAIL), `${PREFIX}.forbidden`, null],
    ['400 with a detail', httpError(400, DETAIL), DETAIL.detail, null],
    // The deliberate behaviour change: three tabs used to show axios' own
    // "Request failed with status code 400" here (the message of the error
    // object — `HTTP 400` in this suite's helper).
    ['400 with no body at all', httpError(400), `${PREFIX}.error.title`, null],
    ['400 with an empty detail', httpError(400, { detail: '   ' }), `${PREFIX}.error.title`, null],
    // 422 is neither 400 nor transient: it reaches the generic title even
    // though it carries a perfectly readable detail.
    ['422 with a detail', httpError(422, DETAIL), `${PREFIX}.error.title`, null],
    // 500 is NOT in TRANSIENT_RETRY_STATUSES — no tab offers "temporarily
    // unavailable" for it, and that is not an oversight to tidy up.
    ['500', httpError(500), `${PREFIX}.error.title`, null],
    ['502 with a detail', httpError(502, DETAIL), `${PREFIX}.unavailable`, DETAIL.detail],
    ['503 with a detail', httpError(503, DETAIL), `${PREFIX}.unavailable`, DETAIL.detail],
    ['504 with a detail', httpError(504, DETAIL), `${PREFIX}.unavailable`, DETAIL.detail],
    ['503 with no body', httpError(503), `${PREFIX}.unavailable`, null],
    ['a dropped connection', networkError('ERR_NETWORK'), `${PREFIX}.unavailable`, null],
    ['a client timeout', networkError('ECONNABORTED'), `${PREFIX}.unavailable`, null],
    ['a read timeout', networkError('ETIMEDOUT'), `${PREFIX}.unavailable`, null],
    // Not an axios error at all — a mapper throwing inside the query fn.
    ['a plain Error', new Error('boom'), `${PREFIX}.error.title`, null],
  ])('maps %s', (_name, error, message, detail) => {
    const { current } = render(error)
    expect(current.errorMessage).toBe(message)
    expect(current.errorDetail).toBe(detail)
  })

  it('flags 403 alone, so only that tab drops its retry button', () => {
    // Retrying a permission cannot help; retrying anything else can.
    expect(render(httpError(403)).current.isForbidden).toBe(true)
    expect(render(httpError(400, DETAIL)).current.isForbidden).toBe(false)
    expect(render(httpError(503)).current.isForbidden).toBe(false)
    expect(render(networkError('ERR_NETWORK')).current.isForbidden).toBe(false)
  })

  it('re-translates when the language changes, with the SAME error object', () => {
    // The language switcher does not remount the reports page — `t()` runs in
    // render, so the message follows the language. Memoizing on `[error]`
    // would leave the previous language's sentence on screen; this is the case
    // that would go red if anyone did.
    const error = httpError(503)
    const { result, rerender } = renderHook(() => useFeedErrorMessage(error, TAB))
    expect(result.current.errorMessage).toBe(`${PREFIX}.unavailable`)

    translate = (key) => `EN ${key}`
    rerender()

    expect(result.current.errorMessage).toBe(`EN ${PREFIX}.unavailable`)
  })

  it('never translates the server detail, and never welds it onto the message', () => {
    // `errorDetail` is the backend's own sentence: the tabs that show it put it
    // on its own line under the localized message, so the operator reads their
    // language and the detail stays quotable to whoever runs the service.
    translate = (key) => `EN ${key}`
    const { current } = render(httpError(503, DETAIL))
    expect(current.errorMessage).toBe(`EN ${PREFIX}.unavailable`)
    expect(current.errorDetail).toBe(DETAIL.detail)
  })

  it('asks under the section of the tab it is NAMED, not a hardcoded one', () => {
    const { current } = renderHook(() => useFeedErrorMessage(httpError(403), 'contactTag')).result
    expect(current.errorMessage).toBe('pages.reports.contactTag.forbidden')
  })

  it('answers the generic title while there is no error at all', () => {
    // Every tab computes the ladder unconditionally and renders it only in the
    // error branch; `undefined` must therefore stay harmless.
    const { current } = render(undefined)
    expect(current.errorMessage).toBe(`${PREFIX}.error.title`)
    expect(current.errorDetail).toBeNull()
    expect(current.isForbidden).toBe(false)
  })
})
