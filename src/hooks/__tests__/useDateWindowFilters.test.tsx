import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWindowTooLong } from '@/lib/reportWindow'
import { useDateWindowFilters, type UseDateWindowFiltersOptions } from '../useDateWindowFilters'

/**
 * The window rule, pinned where the report tabs never pinned it.
 *
 * The tabs' own suites cover the cases a user meets — a hand-edited bound, an
 * inverted pair, an oversized one — and they keep covering them unchanged,
 * which is this extraction's proof of equivalence. What none of them covers is
 * the COMBINATIONS: every one of their invalid-date cases puts exactly one key
 * in the URL and puts a bad value in it, so "one bound valid and the other
 * not", "both bad", and "bad bound in a window that would also be too long"
 * were untested everywhere. Those live here, together with the two properties
 * the tabs depend on and cannot see — that the verdict is right on the FIRST
 * render, and that nothing here is memoized.
 *
 * The translator is stubbed to return the key, so an assertion says which KEY
 * the hook asked for. That the keys exist in both dictionaries is the tabs'
 * own business: unlike its sibling `useFeedErrorMessage`, this hook never
 * builds a key, it is handed whole ones.
 */

/** Swapped by the language-switch case; the default stands in for i18n. */
let translate: (key: string) => string = (key) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => translate(key) }),
}))

afterEach(() => {
  translate = (key) => key
})

const KEYS = {
  invalidDate: 'pages.reports.promisesFeed.invalidDate',
  invertedRange: 'pages.reports.promisesFeed.invalidRange',
} as const

const TOO_LONG_KEY = 'pages.reports.promisesFeed.rangeTooLong'

/** A module-level predicate, exactly as every call site is required to pass. */
const CAP = { isTooLong: isWindowTooLong, messageKey: TOO_LONG_KEY } as const

const TODAY = '2026-09-15'
const MONTH_END = '2026-09-30'

type Options = Omit<UseDateWindowFiltersOptions, 'searchParams' | 'fromKey' | 'toKey'> &
  Partial<Pick<UseDateWindowFiltersOptions, 'fromKey' | 'toKey'>>

function render(query: string, options: Options = { keys: KEYS }) {
  return renderHook(() =>
    useDateWindowFilters({
      searchParams: new URLSearchParams(query),
      fromKey: 'prf',
      toKey: 'prt',
      ...options,
    })
  )
}

/**
 * The shape seven of the ten call sites use: today–today, capped at 366.
 * (The two sell windows use OPTIONAL below; the drains feed is the tenth and
 * the only one whose fallbacks MOVE — the previous working day in its windowed
 * mode, both `undefined` in its all-history one, which is the same "no bound"
 * shape as OPTIONAL with a cap on top.)
 */
const DEFAULTED = { fallbackFrom: TODAY, fallbackTo: TODAY, cap: CAP, keys: KEYS } as const
/** The shape the two sell windows use: no defaults, no cap. */
const OPTIONAL = { keys: KEYS } as const

describe('useDateWindowFilters', () => {
  describe('resolving the bounds', () => {
    it('fills in each ABSENT bound from its own fallback, separately', () => {
      // The asymmetric pair is a real call site (promises-daily defaults to
      // today → end of month), which is why the two fallbacks are separate
      // options and not one "default window".
      const asymmetric = { fallbackFrom: TODAY, fallbackTo: MONTH_END, keys: KEYS }

      expect(render('', asymmetric).result.current).toMatchObject({
        dateFrom: TODAY,
        dateTo: MONTH_END,
        hasWindowError: false,
      })
      // Half a window: the bound that IS given survives, the other is built.
      expect(render('prf=2026-09-01', asymmetric).result.current).toMatchObject({
        dateFrom: '2026-09-01',
        dateTo: MONTH_END,
      })
      expect(render('prt=2026-09-20', asymmetric).result.current).toMatchObject({
        dateFrom: TODAY,
        dateTo: '2026-09-20',
      })
    })

    it('leaves both bounds undefined when there are no fallbacks, and asks for nothing', () => {
      // The low-verification and communication-gap sell windows: "no bound" is
      // a legitimate filter the backend accepts, not a missing value.
      const { current } = render('', OPTIONAL).result
      expect(current.dateFrom).toBeUndefined()
      expect(current.dateTo).toBeUndefined()
      expect(current.dateError).toBeUndefined()
      expect(current.rangeError).toBeUndefined()
      expect(current.hasWindowError).toBe(false)
    })

    it('treats a present-but-EMPTY key as absent, not as a bad value', () => {
      // `?prf=` is what a cleared field can leave behind; it means "no value",
      // and what no value MEANS is the fallback.
      expect(render('prf=&prt=', DEFAULTED).result.current).toMatchObject({
        dateFrom: TODAY,
        dateTo: TODAY,
        isFromInvalid: false,
        hasWindowError: false,
      })
    })
  })

  describe('an unusable bound', () => {
    it.each([
      ['a day the month does not have', 'prf=2026-02-31'],
      ['a month that does not exist', 'prf=2026-13-01'],
      ['text', 'prf=yesterday'],
    ])('refuses %s instead of parsing it into some other day', (_case, query) => {
      // Shape-only validation would let 2026-02-31 through as March 3rd.
      const { current } = render(query, DEFAULTED).result
      expect(current.isFromInvalid).toBe(true)
      expect(current.dateError).toBe(KEYS.invalidDate)
      expect(current.hasWindowError).toBe(true)
    })

    it('resolves to undefined rather than to the fallback — the whole of D1', () => {
      // The field then shows EMPTY (the tabs render `value={dateFrom ?? null}`)
      // instead of the default quietly standing in for a value nobody typed.
      // It is also what makes the guard below unnecessary.
      const { current } = render('prf=2026-02-31', DEFAULTED).result
      expect(current.dateFrom).toBeUndefined()
      expect(current.dateTo).toBe(TODAY)
    })

    it('does NOT report a false inversion when the fallback would look later', () => {
      // The other half of D1, and the reason the two are one decision: with the
      // invalid `from` collapsed to today, `today > 2026-01-10` is true and a
      // pair alert would fire at a user whose window is not inverted at all.
      // Reinstating the default for an invalid bound without the old
      // `!hasInvalidDate` guard is what this case catches.
      const { current } = render('prf=2026-02-31&prt=2026-01-10', DEFAULTED).result
      expect(current.dateError).toBe(KEYS.invalidDate)
      expect(current.rangeError).toBeUndefined()
    })

    it('lets the FIELD error win over a window that would also be too long', () => {
      // Untested in every tab suite. `from` unusable, `to` a decade away: the
      // complaint is the bound, and the pair alert stays silent because there
      // is no pair to measure.
      const { current } = render('prf=2026-02-31&prt=2036-01-10', DEFAULTED).result
      expect(current.dateError).toBe(KEYS.invalidDate)
      expect(current.rangeError).toBeUndefined()
      expect(current.hasWindowError).toBe(true)
    })

    it('marks only the offending bound when the other one is VALID', () => {
      // Untested in every tab suite: each of their cases sets exactly one key.
      // The flags are per bound because the tabs put the message on a field.
      const { current } = render('prf=2026-06-01&prt=2026-13-01', DEFAULTED).result
      expect(current.isFromInvalid).toBe(false)
      expect(current.isToInvalid).toBe(true)
      expect(current.dateFrom).toBe('2026-06-01')
      expect(current.dateTo).toBeUndefined()
      expect(current.dateError).toBe(KEYS.invalidDate)
    })

    it('marks BOTH bounds with the one message when both are unusable', () => {
      const { current } = render('prf=2026-02-31&prt=2026-13-01', DEFAULTED).result
      expect(current.isFromInvalid).toBe(true)
      expect(current.isToInvalid).toBe(true)
      // One sentence, shown twice by the tab — one per field — because the
      // complaint about each bound is the same complaint.
      expect(current.dateError).toBe(KEYS.invalidDate)
      expect(current.rangeError).toBeUndefined()
    })
  })

  describe('the pair', () => {
    it('reports an inverted window and nothing else', () => {
      const { current } = render('prf=2026-06-20&prt=2026-06-10', DEFAULTED).result
      expect(current.rangeError).toBe(KEYS.invertedRange)
      expect(current.dateError).toBeUndefined()
      // Neither bound is wrong on its own, so neither field is singled out.
      expect(current.isFromInvalid).toBe(false)
      expect(current.isToInvalid).toBe(false)
      expect(current.hasWindowError).toBe(true)
    })

    it('never calls a HALF-specified window inverted', () => {
      // Only a fully specified window can be inverted; a single bound is an
      // open-ended filter where the caller allows one.
      const { current } = render('prf=2026-06-20', OPTIONAL).result
      expect(current.rangeError).toBeUndefined()
      expect(current.hasWindowError).toBe(false)
    })

    it('reports a window wider than the cap', () => {
      const { current } = render('prf=2024-01-01&prt=2026-01-01', DEFAULTED).result
      expect(current.rangeError).toBe(TOO_LONG_KEY)
      expect(current.dateError).toBeUndefined()
      expect(current.hasWindowError).toBe(true)
    })

    it('measures the cap over the window the FALLBACK completed', () => {
      // Not covered by any tab: one bound given, the other defaulted, and it is
      // the default that makes the window oversized. The cap has to see the
      // resolved window, not the URL's half of it.
      const { current } = render('prf=2020-01-01', DEFAULTED).result
      expect(current.dateFrom).toBe('2020-01-01')
      expect(current.dateTo).toBe(TODAY)
      expect(current.rangeError).toBe(TOO_LONG_KEY)
    })

    it.each([
      ['inverted only', 'prf=2026-06-20&prt=2026-06-10', KEYS.invertedRange],
      ['too long only', 'prf=2024-01-01&prt=2026-01-01', TOO_LONG_KEY],
      // Inverted AND far enough apart to be "too long" if the cap were measured
      // over the ABSOLUTE difference. It is not — the difference goes negative
      // and `isWindowTooLong` answers false — so this row has ONE finding
      // today. It is a table rather than a sentence in a docstring precisely
      // because the day somebody rewrites a cap over `Math.abs`, the overlap
      // becomes real and the ORDER here is what decides which alert is seen.
      ['inverted by more than the cap', 'prf=2026-01-01&prt=2024-01-01', KEYS.invertedRange],
    ])('shows the pair alert for %s', (_case, query, expected) => {
      expect(render(query, DEFAULTED).result.current.rangeError).toBe(expected)
    })

    it('passes a decade-wide window when the caller supplies NO cap', () => {
      // The mirror of the uncapped tabs: an absent `cap` is a decision, and
      // this is the hook-level half of pinning it.
      const { current } = render('prf=2016-01-01&prt=2026-01-01', OPTIONAL).result
      expect(current.rangeError).toBeUndefined()
      expect(current.hasWindowError).toBe(false)
    })

    it('asks the cap it is GIVEN, with the resolved bounds, and quotes ITS key', () => {
      // A second rule exists on this page (the outbound report counts 90 days
      // INCLUSIVELY), which is why the option is a predicate and not a number.
      const isTooLong = vi.fn().mockReturnValue(true)
      const { current } = render('prf=2026-06-01&prt=2026-06-05', {
        ...DEFAULTED,
        cap: { isTooLong, messageKey: 'some.other.cap' },
      }).result
      expect(isTooLong).toHaveBeenCalledWith('2026-06-01', '2026-06-05')
      expect(current.rangeError).toBe('some.other.cap')
    })

    it('does not consult the cap at all while a bound is missing', () => {
      // `isWindowTooLong` would answer false on a NaN anyway, but a caller's
      // predicate is the caller's, and calling it with undefined is not part of
      // the contract.
      const isTooLong = vi.fn().mockReturnValue(true)
      const cap = { isTooLong, messageKey: 'some.other.cap' }
      expect(
        render('prf=2026-06-01', { keys: KEYS, cap }).result.current.rangeError
      ).toBeUndefined()
      expect(
        render('prf=2026-02-31', { ...DEFAULTED, cap }).result.current.rangeError
      ).toBeUndefined()
      expect(isTooLong).not.toHaveBeenCalled()
    })
  })

  describe('as a pure derivation of the render', () => {
    it('knows on the FIRST frame, before any rerender', () => {
      // Every caller feeds this straight into its query's `enabled`. Held in
      // state and filled by an effect, the first frame would answer false and
      // the request would already be gone by the time the verdict arrived.
      let renders = 0
      const { result } = renderHook(() => {
        renders += 1
        return useDateWindowFilters({
          searchParams: new URLSearchParams('prf=2026-02-31'),
          fromKey: 'prf',
          toKey: 'prt',
          ...DEFAULTED,
        })
      })
      expect(result.current.hasWindowError).toBe(true)
      // ...and it took exactly one render to get there: a `useState` seeded
      // empty plus a `useEffect` would need a second commit, which is the frame
      // the request would have gone out in.
      expect(renders).toBe(1)
    })

    it('follows a NEW options object — nothing is memoized on the previous one', () => {
      // Р3б: the call sites build a fresh literal every render. Nothing here
      // memoizes on it, so nothing can go stale — and the module-level
      // `WINDOW_ERROR_KEYS`/`WINDOW_CAP` at the call sites are for readability,
      // not for identity.
      //
      // The two predicates ANSWER DIFFERENTLY on purpose. A window that yields
      // no finding would make this test pass whether the hook re-read the new
      // options or kept the old ones — "no error" equals "no error". So the
      // first arrow says the window is fine and the second says it is too
      // long: the only way to see the second answer is to have called it.
      const { result, rerender } = renderHook(
        (props: { cap: { isTooLong: (a: string, b: string) => boolean; messageKey: string } }) =>
          useDateWindowFilters({
            searchParams: new URLSearchParams('prf=2026-06-01&prt=2026-06-05'),
            fromKey: 'prf',
            toKey: 'prt',
            fallbackFrom: TODAY,
            fallbackTo: TODAY,
            cap: props.cap,
            keys: { invalidDate: KEYS.invalidDate, invertedRange: KEYS.invertedRange },
          }),
        {
          initialProps: {
            cap: {
              // Annotated: a bare `() => false` would type the prop as the
              // literal `false` and make the `() => true` rerender below a
              // type error.
              isTooLong: (): boolean => false,
              messageKey: TOO_LONG_KEY,
            },
          },
        }
      )
      expect(result.current.rangeError).toBeUndefined()
      expect(result.current.hasWindowError).toBe(false)

      // A brand-new options object whose predicate now says "too long".
      rerender({
        cap: {
          isTooLong: (): boolean => true,
          messageKey: TOO_LONG_KEY,
        },
      })

      expect(result.current.rangeError).toBe(TOO_LONG_KEY)
      expect(result.current.hasWindowError).toBe(true)
      // The bounds themselves did not move — only the verdict followed the
      // new predicate.
      expect(result.current.dateFrom).toBe('2026-06-01')
      expect(result.current.dateTo).toBe('2026-06-05')
    })

    it('re-translates when the language changes', () => {
      // The language switcher does not remount the reports page; `t()` runs in
      // render, so the message follows the language. Wrapping the result in a
      // `useMemo` without `t` in its dependencies is what this would catch.
      const { result, rerender } = renderHook(() =>
        useDateWindowFilters({
          searchParams: new URLSearchParams('prf=2026-06-20&prt=2026-06-10'),
          fromKey: 'prf',
          toKey: 'prt',
          keys: KEYS,
        })
      )
      expect(result.current.rangeError).toBe(KEYS.invertedRange)

      translate = (key) => `EN ${key}`
      rerender()

      expect(result.current.rangeError).toBe(`EN ${KEYS.invertedRange}`)
    })

    it('asks under the keys it is GIVEN, not a spelling of its own', () => {
      // Two of the ten sections name these messages `invalidSell*`, which is
      // why whole keys are passed and no prefix is ever concatenated here.
      const sellKeys = {
        invalidDate: 'pages.reports.lowVerification.invalidSellDate',
        invertedRange: 'pages.reports.lowVerification.invalidSellRange',
      }
      expect(render('prf=2026-02-31', { keys: sellKeys }).result.current.dateError).toBe(
        sellKeys.invalidDate
      )
      expect(
        render('prf=2026-06-20&prt=2026-06-10', { keys: sellKeys }).result.current.rangeError
      ).toBe(sellKeys.invertedRange)
    })
  })
})
