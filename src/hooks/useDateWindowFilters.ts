import { useTranslation } from 'react-i18next'
import { isDatePairInverted, readUrlDateBound } from '@/lib/urlDateBound'

/**
 * The localized names of this window's two complaints. FULL keys, never a
 * prefix plus a suffix.
 *
 * Most report sections spell them `invalidDate`/`invalidRange`, but the two
 * sell windows spell them `invalidSellDate`/`invalidSellRange`, so a
 * "prefix + suffix" option could not describe every caller — and a
 * concatenated key is invisible to a static scanner, which is the hole the
 * sibling `useFeedErrorMessage` had to bring a gate for. Whole literals stay
 * greppable exactly as they were before this hook existed.
 */
export interface DateWindowErrorKeys {
  /** A bound that is not a real calendar day. Rides the FIELD holding it. */
  invalidDate: string
  /** `from` later than `to`. Rides the PAIR alert — neither bound is wrong alone. */
  invertedRange: string
}

/**
 * A window-size limit and the sentence that explains it — ONE option, because
 * either half alone is a defect: a predicate without a key renders
 * `t(undefined)`, a key without a predicate is a string nothing can reach.
 */
export interface DateWindowCap {
  /**
   * A MODULE-level function, not an arrow written at the call site. Both are
   * correct here (nothing in this hook memoizes on it), but a named predicate
   * is what makes the two different rules on this page — the shared 366-day
   * DIFFERENCE and the outbound report's own 90 INCLUSIVE days — visible as
   * two rules rather than as two look-alike expressions.
   */
  isTooLong: (dateFrom: string, dateTo: string) => boolean
  /** The pair alert for "wider than this endpoint answers". */
  messageKey: string
}

export interface UseDateWindowFiltersOptions {
  searchParams: URLSearchParams
  fromKey: string
  toKey: string
  /** What an ABSENT (or empty, `?from=`) `fromKey` means; undefined = "no lower bound". */
  fallbackFrom?: string
  /** What an ABSENT (or empty, `?to=`) `toKey` means; undefined = "no upper bound". */
  fallbackTo?: string
  /** Absent = this endpoint does not cap its window, deliberately. */
  cap?: DateWindowCap
  keys: DateWindowErrorKeys
}

export interface DateWindowFilters {
  /** The usable bound; undefined when the URL value is unusable OR there is no default. */
  dateFrom: string | undefined
  dateTo: string | undefined
  isFromInvalid: boolean
  isToInvalid: boolean
  /** Localized; set exactly when EITHER bound is unusable. */
  dateError: string | undefined
  /** Localized pair alert: inversion first, then the cap. */
  rangeError: string | undefined
  /** The verdict of the WINDOW ONLY — see the naming paragraph below. */
  hasWindowError: boolean
}

/**
 * One reading of a report tab's date window: the two bounds, what is wrong
 * with them, and whether anything may be requested.
 *
 * Every report tab that owns a date pair used to spell this out itself —
 * read both bounds, fill in the defaults, refuse an impossible day, refuse an
 * inverted pair, refuse an oversized one, decide which message goes on a field
 * and which goes under the filters — in blocks that were the same rule written
 * several different ways. None of that is tab knowledge: it is how THIS client
 * turns a query string into a window. What IS tab knowledge stays at the call
 * site — which URL keys, what an absent bound means, whether this endpoint caps
 * anything, and which field a message sits on.
 *
 * THE ONE BEHAVIOURAL DECISION, AND IT IS TWO HALVES OF ONE DECISION. An
 * unusable bound resolves to `undefined` here, NOT to the tab's default, and
 * *because of that* the only guard on the pair checks is presence
 * (`!!dateFrom && !!dateTo`). Both spellings existed before this hook: some
 * tabs kept the default in the variable and masked the field in JSX
 * (`value={isFromInvalid ? null : dateFrom}`), guarding their inversion check
 * with "no bound is invalid"; the rest resolved to `undefined` and guarded on
 * presence. They agree on screen and on the wire — the request is blocked
 * either way and the value that reaches the query hook is the default either
 * way — so the one that carries more information wins: `undefined` can tell
 * "today because the tab defaults to today" from "today because the URL held
 * rubbish", and it is the only spelling available to a tab with no default at
 * all.
 *
 * ⚠️ DO NOT REMOVE ONE HALF AND KEEP THE OTHER. The `!hasInvalidDate &&` in
 * front of the old inversion checks was NOT redundant the way the cap guards
 * removed with `useFeedErrorMessage` were: with an invalid `from` collapsed to
 * the default, `today > dateTo` would fire "the window is inverted" at a user
 * whose window is nothing of the kind. It is redundant ONLY once an invalid
 * bound is `undefined`, which is what this hook does. Reintroduce the default
 * for an invalid bound without putting that guard back and the false alert
 * comes with it.
 *
 * NO `useState`, NO `useEffect`, NO `useMemo`. The only impure call in here is
 * `useTranslation`. Every caller feeds `hasWindowError` straight into its
 * query's `enabled`, so a verdict that arrived a frame late would be a frame in
 * which the request had already gone out carrying the parameters this hook
 * exists to refuse; a plain expression is true on the first render and on every
 * render after. It also makes the hook indifferent to a render-phase
 * `setState` upstream (the contact-tag feed runs its component body twice) and
 * to a fresh options literal on every render — there is nothing here to
 * invalidate. The result object is new each render and that is safe: every
 * caller destructures it, and the bounds travel onward as primitives inside a
 * query-key object react-query hashes structurally.
 *
 * `t()` runs in render, unmemoized, for the same reason as in
 * `useFeedErrorMessage`: the language switcher does not remount the reports
 * page, so a cached sentence would stay on screen in the previous language.
 * Strings come out rather than keys because `dateError` goes into `DateSelect`'s
 * `error` prop, which needs a string in every caller; only the pair alert could
 * have taken a key, and only in a minority of them.
 *
 * WHY `hasWindowError` AND NOT `hasFilterError`. Two callers have a filter
 * that is not part of the window — the low-verification cap and the
 * communication-gap floor — and their `hasFilterError` has to include it.
 * Named `hasFilterError`, this field would read as the whole verdict and
 * `enabled: !hasFilterError` would look right while letting `?mv=-1` reach the
 * backend for a 422. Named for the window, it composes honestly: a tab with
 * other filters ORs them in, and a tab whose only filter IS the window writes
 * `const hasFilterError = hasWindowError`.
 *
 * WHICH FIELD a message sits on stays in the JSX (`error={isFromInvalid ?
 * dateError : undefined}`): that is a statement about the layout of a tab, not
 * about its window.
 *
 * NOT ADOPTED BY THREE REPORT TABS, each for its own reason and none of them
 * cosmetic. Client processing replaces an unusable value with today and sends
 * the request anyway — a long-standing rule of that screen; its pickers have no
 * `error` prop to carry a complaint and its locale section has no
 * `invalidDate` key, so converting it would be a visible redesign. Third-party
 * verification measures TWO windows and folds "bad date", "inverted" and "too
 * long" into a SINGLE alert, where the others let a field error suppress the
 * pair alert — a different division of messages, not a different number of
 * windows. The contact-tag feed reads two of its three dates through readers of
 * its own (a mandatory single day, and an upper bound with three states), and a
 * shared reader would flatten "absent" into "empty" where both meanings matter.
 *
 * NO GATE SHIPS WITH THIS HOOK, and that is a finding rather than an omission.
 * The gate `useFeedErrorMessage` owes exists because that extraction CREATED a
 * defect class — keys assembled by concatenation, which no scanner can follow.
 * Nothing of the kind happens here: message keys are passed whole and stay as
 * greppable as they were, and the URL keys come from the same page-wide
 * registry the tabs already destructure. The one risk the extraction does add
 * is a call copied wholesale from a neighbouring tab — and every caller's suite
 * already pins both halves of such a call, the URL key spelling and the message
 * key, so a transplanted call goes red somewhere. The single real hole is that
 * "this endpoint caps nothing" was pinned by nothing at all; a gate cannot see
 * it (what would be guarded is the ABSENCE of an option, not the spelling of a
 * name), so the uncapped tabs' suites each gained a test that a window wider
 * than the cap does go out.
 */
export function useDateWindowFilters({
  searchParams,
  fromKey,
  toKey,
  fallbackFrom,
  fallbackTo,
  cap,
  keys,
}: UseDateWindowFiltersOptions): DateWindowFilters {
  const { t } = useTranslation('common')

  // A present-but-unusable bound is NOT silently replaced by the default: the
  // URL would then disagree with both the field and the request, and a
  // shape-only check would wave an impossible day like 2026-02-31 through to
  // the API. Tracked per bound so the hint can sit on the offending field.
  const fromBound = readUrlDateBound(searchParams, fromKey)
  const toBound = readUrlDateBound(searchParams, toKey)
  const isFromInvalid = fromBound.isInvalid
  const isToInvalid = toBound.isInvalid

  // An ABSENT key means the caller's default (which may itself be "no bound");
  // only an explicitly bad one stays undefined and blocks the request.
  const dateFrom = fromBound.value ?? (isFromInvalid ? undefined : fallbackFrom)
  const dateTo = toBound.value ?? (isToInvalid ? undefined : fallbackTo)

  // Presence is the only guard either check needs — see the docstring. A
  // half-specified window is a legitimate open-ended filter where the caller
  // allows one, and an unusable bound has already been reported on its field.
  const isInverted = isDatePairInverted(dateFrom, dateTo)
  // The predicate and its message are read together, so "too long" cannot be
  // true with no sentence to show for it.
  const tooLongKey =
    cap && dateFrom && dateTo && cap.isTooLong(dateFrom, dateTo) ? cap.messageKey : undefined

  const hasInvalidDate = isFromInvalid || isToInvalid

  // The ORDER of the two pair findings is pinned by this hook's suite rather
  // than argued from the predicates. Today the two cannot both hold — an
  // inverted pair measures negative and no cap predicate calls that too long —
  // but that is a fact about the predicates a caller supplies, and a cap
  // rewritten over the ABSOLUTE difference would make the overlap real.
  const rangeError = isInverted
    ? t(keys.invertedRange)
    : tooLongKey !== undefined
      ? t(tooLongKey)
      : undefined

  return {
    dateFrom,
    dateTo,
    isFromInvalid,
    isToInvalid,
    dateError: hasInvalidDate ? t(keys.invalidDate) : undefined,
    rangeError,
    hasWindowError: hasInvalidDate || isInverted || tooLongKey !== undefined,
  }
}
